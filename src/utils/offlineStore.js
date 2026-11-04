// 오프라인 자료 저장소: 시·도별 AED·대피소 목록을 휴대폰(IndexedDB)에 보관
// - 목록(몇 MB)은 IndexedDB, 저장 현황(지역·개수·날짜)은 빨리 읽도록 localStorage에 따로 둔다
import REGIONS from '../../shared/offlineRegions.json';

const DB_NAME = 'safemap-offline';
const DB_VERSION = 2;
const STORE = 'packs';
export const MAP_STORE = 'maps';
const META_KEY = 'safemap_offline_meta_v1';

export { REGIONS };

export function findRegionByName(name) {
  if (!name) return null;
  return REGIONS.find((r) => r.aliases.some((alias) => name === alias || name.startsWith(alias))) || null;
}

let dbPromise = null;
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB를 쓸 수 없어요.'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      // v1: 시설 자료(packs), v2: 오프라인 지도 파일(maps)
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(MAP_STORE)) db.createObjectStore(MAP_STORE, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

export function run(mode, fn, storeName = STORE) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const req = fn(tx.objectStore(storeName));
        tx.oncomplete = () => resolve(req?.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export function readMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function writeMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (e) {
    // 저장 공간 부족은 무시
  }
}

// 오프라인 검색 때 매번 디스크에서 읽지 않도록 한 번 읽은 목록은 메모리에 둔다
const memory = new Map();

export async function savePack(pack) {
  const key = `${pack.category}:${pack.region}`;
  await run('readwrite', (store) => store.put({ key, ...pack }));
  memory.set(key, pack);
  const meta = readMeta();
  meta[key] = { category: pack.category, region: pack.region, count: pack.count, updatedAt: pack.updatedAt };
  writeMeta(meta);
}

export async function loadPack(category, region) {
  const key = `${category}:${region}`;
  if (memory.has(key)) return memory.get(key);
  const pack = await run('readonly', (store) => store.get(key)).catch(() => null);
  if (pack) memory.set(key, pack);
  return pack || null;
}

export async function removeRegion(region) {
  const meta = readMeta();
  await Promise.all(
    ['aed', 'shelter'].map((category) => {
      const key = `${category}:${region}`;
      memory.delete(key);
      delete meta[key];
      return run('readwrite', (store) => store.delete(key)).catch(() => null);
    })
  );
  writeMeta(meta);
}

// 저장해 둔 지역 목록: [{ region, label, aed: {count, updatedAt}, shelter: {...} }]
export function listSavedRegions(meta = readMeta()) {
  return REGIONS.map((r) => ({
    region: r.key,
    label: r.label,
    aed: meta[`aed:${r.key}`] || null,
    shelter: meta[`shelter:${r.key}`] || null,
  })).filter((r) => r.aed || r.shelter);
}

export async function downloadPack(category, region) {
  const res = await fetch(`/api/offline/${category}?region=${encodeURIComponent(region)}`);
  if (!res.ok) throw new Error(`오프라인 자료 응답 ${res.status}`);
  const pack = await res.json();
  if (!pack?.success || !Array.isArray(pack.rows)) throw new Error('오프라인 자료 형식이 올바르지 않아요.');
  await savePack(pack);
  return pack;
}
