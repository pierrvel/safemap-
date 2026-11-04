// 오프라인 지도: 시·도별 OpenStreetMap 지도 파일(.pmtiles)을 내려받아 휴대폰(IndexedDB)에 보관
// - 카카오 지도는 약관상 저장할 수 없어, 인터넷이 없을 때만 이 지도로 보여준다
import MAP_CONFIG from '../../shared/offlineMap.json';
import { MAP_STORE, run } from './offlineStore';

const META_KEY = 'safemap_offline_maps_v1';

export const MAP_BASE_URL = (import.meta.env.VITE_OFFLINE_MAP_BASE_URL || MAP_CONFIG.baseUrl || '').replace(/\/$/, '');

// 오프라인 지도가 쓰는 글꼴·아이콘 (앱에 들어 있음, public/map-assets)
const FONT_STACKS = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'];
const FONT_RANGES = ['0-255', '256-511', '8192-8447', '8448-8703'];
export const MAP_ASSET_URLS = [
  ...FONT_STACKS.flatMap((font) => FONT_RANGES.map((r) => `/map-assets/fonts/${encodeURIComponent(font)}/${r}.pbf`)),
  '/map-assets/sprites/light.json',
  '/map-assets/sprites/light.png',
  '/map-assets/sprites/light@2x.json',
  '/map-assets/sprites/light@2x.png',
];

export function isOfflineMapAvailable() {
  return !!MAP_BASE_URL;
}

export function readMapMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function writeMapMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (e) {
    // 저장 공간 부족은 무시
  }
}

let manifestPromise = null;
export function fetchMapManifest() {
  if (!MAP_BASE_URL) return Promise.resolve(null);
  if (!manifestPromise) {
    manifestPromise = fetch(`${MAP_BASE_URL}/manifest.json`, { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((m) => {
        if (!m) manifestPromise = null;
        return m;
      });
  }
  return manifestPromise;
}

// 지도를 쓰려면 지도 화면 코드와 글꼴·아이콘이 서비스 워커 캐시에 있어야 한다
// (지도를 받을 때, 그리고 앱이 업데이트된 뒤 온라인으로 열릴 때 한 번씩 미리 불러 둔다)
export async function warmOfflineMapAssets() {
  await Promise.all([
    import('../components/v2/OfflineMapView').catch(() => null),
    ...MAP_ASSET_URLS.map((url) => fetch(url).catch(() => null)),
  ]);
}

/**
 * 시·도 지도 파일을 내려받아 저장. onProgress(0~1)
 */
export async function downloadMap(region, onProgress) {
  const manifest = await fetchMapManifest();
  const entry = manifest?.regions?.[region];
  if (!entry) throw new Error('이 지역 지도 파일을 찾지 못했어요.');

  const res = await fetch(`${MAP_BASE_URL}/${entry.file}`);
  if (!res.ok || !res.body) throw new Error(`지도 파일 응답 ${res.status}`);
  const total = Number(res.headers.get('Content-Length')) || entry.bytes || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onProgress?.(Math.min(1, received / total));
  }
  const blob = new Blob(chunks, { type: 'application/octet-stream' });
  await run('readwrite', (store) => store.put({ key: region, blob, file: entry.file }), MAP_STORE);

  const meta = readMapMeta();
  meta[region] = { bytes: blob.size, date: manifest.date, file: entry.file, bbox: entry.bbox };
  writeMapMeta(meta);
  await warmOfflineMapAssets();
  navigator.storage?.persist?.().catch(() => {});
  return meta[region];
}

export async function removeMap(region) {
  await run('readwrite', (store) => store.delete(region), MAP_STORE).catch(() => null);
  const meta = readMapMeta();
  delete meta[region];
  writeMapMeta(meta);
}

export async function loadMapBlob(region) {
  const record = await run('readonly', (store) => store.get(region), MAP_STORE).catch(() => null);
  return record?.blob ? record : null;
}

// 지금 위치가 들어가는 저장된 지도 (여러 개면 가장 좁은 지역: 서울은 경기 범위 안에도 들어감)
export function findMapRegionFor(lat, lon, meta = readMapMeta()) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const hits = Object.entries(meta).filter(([, m]) => {
    const [w, s, e, n] = m.bbox || [];
    return lon >= w && lon <= e && lat >= s && lat <= n;
  });
  if (!hits.length) return null;
  const area = ([w, s, e, n]) => (e - w) * (n - s);
  hits.sort((a, b) => area(a[1].bbox) - area(b[1].bbox));
  return hits[0][0];
}
