// 오프라인 자료: 시·도 단위로 AED·대피소 전체 목록을 작게 묶어 내려준다
// (인터넷이 없어도 휴대폰에 저장해 둔 자료로 가까운 시설을 찾기 위함)
const { getShelters } = require('./shelters');
const { mapWithConcurrency } = require('./utils');
const REGIONS = require('../shared/offlineRegions.json');

const getDataGoKrKey = () => process.env.DATA_GO_KR_KEY || '';
const AED_PAGE_SIZE = 1000;
const PACK_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const packCache = new Map(); // `${category}:${region}` -> { pack, expiresAt }

function findRegion(key) {
  return REGIONS.find((r) => r.key === key) || null;
}

// 시간 값은 원본 그대로(숫자) 두고, 개방 여부 판정은 휴대폰에서 같은 규칙으로 한다
function toTimeValue(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
}

const AED_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function compactAed(raw) {
  const lat = parseFloat(raw.wgs84Lat);
  const lon = parseFloat(raw.wgs84Lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 33 || lat > 39 || lon < 124 || lon > 132) return null;
  const seq = raw.serialSeq && String(raw.serialSeq).trim();
  if (!seq) return null;
  const hours = AED_DAYS.flatMap((d) => [toTimeValue(raw[`${d}SttTme`]), toTimeValue(raw[`${d}EndTme`])]);
  return [`AED-${seq}`, +lat.toFixed(6), +lon.toFixed(6), raw.buildPlace || '', raw.org || '', raw.buildAddress || '', hours];
}

async function fetchAedPage(region, pageNo) {
  const url =
    'https://apis.data.go.kr/B552657/AEDInfoInqireService/getEgytAedManageInfoInqire' +
    `?serviceKey=${getDataGoKrKey()}&pageNo=${pageNo}&numOfRows=${AED_PAGE_SIZE}&_type=json&Q0=${encodeURIComponent(region.aedName)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`AED list status ${res.status}`);
  const json = await res.json();
  const resultCode = json?.response?.header?.resultCode;
  if (resultCode && resultCode !== '00') throw new Error(`AED list result ${resultCode}`);
  const body = json?.response?.body;
  const items = body?.items?.item || [];
  return { total: Number(body?.totalCount) || 0, items: Array.isArray(items) ? items : [items] };
}

async function buildAedPack(region) {
  const first = await fetchAedPage(region, 1);
  const pages = Math.ceil(first.total / AED_PAGE_SIZE);
  const rest = await mapWithConcurrency(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => i + 2),
    4,
    (pageNo) => fetchAedPage(region, pageNo)
  );
  const seen = new Set();
  const rows = [];
  [first, ...rest].forEach((page) =>
    page.items.forEach((raw) => {
      const row = compactAed(raw);
      if (row && !seen.has(row[0])) {
        seen.add(row[0]);
        rows.push(row);
      }
    })
  );
  return rows;
}

function buildShelterPack(region) {
  // 대피소 원본: [id, 이름, 주소, 지상/지하, 수용인원, 면적, 위도, 경도]
  return getShelters()
    .filter((s) => region.aliases.some((alias) => (s.buildAddress || '').startsWith(`${alias} `)))
    .map((s) => [s.id, s.name, s.buildAddress, s.floorType, s.capacity, s.area, s.lat, s.lon]);
}

async function getOfflinePack(category, regionKey) {
  const region = findRegion(regionKey);
  if (!region) throw Object.assign(new Error('알 수 없는 지역입니다.'), { status: 400 });
  if (category !== 'aed' && category !== 'shelter') throw Object.assign(new Error('알 수 없는 종류입니다.'), { status: 400 });

  const cacheKey = `${category}:${region.key}`;
  const cached = packCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.pack;

  const rows = category === 'aed' ? await buildAedPack(region) : buildShelterPack(region);
  // 시·도마다 AED가 수백~수만 곳이라, 비어 있으면 원본 오류로 보고 저장·전송하지 않는다 (휴대폰에 빈 자료가 저장되지 않게)
  if (rows.length === 0) throw Object.assign(new Error('자료를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.'), { status: 502 });
  const pack = {
    success: true,
    version: 1,
    category,
    region: region.key,
    label: region.label,
    updatedAt: new Date().toISOString(),
    count: rows.length,
    rows,
  };
  packCache.set(cacheKey, { pack, expiresAt: Date.now() + PACK_CACHE_TTL_MS });
  return pack;
}

module.exports = { getOfflinePack, REGIONS };
