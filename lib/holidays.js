// 공휴일 판정 (한국천문연구원 특일 정보 API + 내장 보조 목록)
// ※ 공공데이터포털에서 '한국천문연구원_특일 정보' 활용 신청이 되어 있어야 API가 동작하며,
//   API를 쓸 수 없으면 아래 내장 목록으로 판정
const getDataGoKrKey = () => process.env.DATA_GO_KR_KEY || '';

// 매년 같은 날짜의 양력 공휴일 (MMDD)
const FIXED_HOLIDAYS = new Set(['0101', '0301', '0505', '0606', '0815', '1003', '1009', '1225']);

// 음력 공휴일·대체공휴일·선거일 등 해마다 바뀌는 날짜 (YYYYMMDD)
const VARIABLE_HOLIDAYS = new Set([
  // 2026: 설날, 3·1절 대체, 부처님오신날 대체, 지방선거, 광복절 대체, 추석, 개천절 대체
  '20260216', '20260217', '20260218', '20260302', '20260524', '20260525', '20260603',
  '20260817', '20260924', '20260925', '20260926', '20261005',
  // 2027: 설날(+대체), 부처님오신날, 광복절 대체, 추석, 개천절·한글날·성탄절 대체
  '20270206', '20270207', '20270208', '20270209', '20270513', '20270816',
  '20270914', '20270915', '20270916', '20271004', '20271011', '20271227',
]);

const YEAR_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const YEAR_FAIL_TTL_MS = 60 * 60 * 1000;
const yearCache = new Map(); // year -> { dates: Set|null, expiresAt }

async function fetchYearHolidays(year) {
  const key = getDataGoKrKey();
  if (!key) return null;
  const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${key}&solYear=${year}&numOfRows=100&_type=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.response?.body?.items?.item;
    if (!items) return null;
    const list = Array.isArray(items) ? items : [items];
    return new Set(list.filter((i) => i.isHoliday === 'Y').map((i) => String(i.locdate)));
  } catch (e) {
    return null;
  }
}

// dateKey: 'YYYYMMDD' (KST 기준)
async function isKstHoliday(dateKey) {
  if (!dateKey || dateKey.length !== 8) return false;
  const year = dateKey.slice(0, 4);

  let entry = yearCache.get(year);
  if (!entry || Date.now() > entry.expiresAt) {
    const dates = await fetchYearHolidays(year);
    entry = { dates, expiresAt: Date.now() + (dates ? YEAR_CACHE_TTL_MS : YEAR_FAIL_TTL_MS) };
    yearCache.set(year, entry);
  }

  if (entry.dates) return entry.dates.has(dateKey);
  return FIXED_HOLIDAYS.has(dateKey.slice(4)) || VARIABLE_HOLIDAYS.has(dateKey);
}

module.exports = { isKstHoliday };
