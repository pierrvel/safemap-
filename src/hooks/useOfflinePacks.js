import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadPack, findRegionByName, listSavedRegions, readMeta, removeRegion } from '../utils/offlineStore';
import {
  downloadMap as downloadMapFile,
  fetchMapManifest,
  findMapRegionFor,
  isOfflineMapAvailable,
  readMapMeta,
  removeMap,
  warmOfflineMapAssets,
} from '../utils/offlineMapStore';

const STALE_MS = 7 * 24 * 60 * 60 * 1000;
// 첫 화면의 답(시설 조회·도보 경로)이 먼저 끝나도록 잠시 뒤에 받는다
const AUTO_DELAY_MS = 4000;

function isStale(meta, key) {
  const entry = meta[key];
  return !entry || Date.now() - Date.parse(entry.updatedAt) > STALE_MS;
}

/**
 * 오프라인 자료 관리: 지금 있는 시·도를 알아내 자동으로 저장하고(7일마다 새로 받음),
 * 안내 창에서 다른 지역을 받거나 지울 수 있게 한다.
 */
export default function useOfflinePacks({ coords, kakaoReady, isOnline }) {
  const [meta, setMeta] = useState(readMeta);
  const [currentRegion, setCurrentRegion] = useState(null);
  const [busyRegion, setBusyRegion] = useState(null);
  const [failedRegion, setFailedRegion] = useState(null);
  const autoTriedRef = useRef(new Set());
  const [mapMeta, setMapMeta] = useState(readMapMeta);
  const [mapSizes, setMapSizes] = useState({});
  const [mapProgress, setMapProgress] = useState(null); // { region, ratio }
  const [mapFailedRegion, setMapFailedRegion] = useState(null);
  const mapAvailable = isOfflineMapAvailable();

  // 1. 지금 위치의 시·도 (약 1km 단위로만 다시 확인)
  const latKey = coords?.lat ? coords.lat.toFixed(2) : null;
  const lonKey = coords?.lon ? coords.lon.toFixed(2) : null;
  useEffect(() => {
    if (!kakaoReady || !isOnline || !latKey || !window.kakao?.maps?.services) return;
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.coord2RegionCode(Number(lonKey), Number(latKey), (result, status) => {
      if (status !== window.kakao.maps.services.Status.OK || !result?.length) return;
      const name = (result.find((r) => r.region_type === 'B') || result[0]).region_1depth_name;
      const region = findRegionByName(name);
      if (region) setCurrentRegion(region.key);
    });
  }, [kakaoReady, isOnline, latKey, lonKey]);

  const download = useCallback(async (region, { onlyStale = false } = {}) => {
    setBusyRegion(region);
    setFailedRegion(null);
    try {
      const current = readMeta();
      for (const category of ['aed', 'shelter']) {
        if (!onlyStale || isStale(current, `${category}:${region}`)) await downloadPack(category, region);
      }
      // 저장 공간이 부족할 때 브라우저가 먼저 지우지 않도록 요청 (지원하는 브라우저만)
      navigator.storage?.persist?.().catch(() => {});
    } catch (e) {
      setFailedRegion(region);
    } finally {
      setMeta(readMeta());
      setBusyRegion(null);
    }
  }, []);

  // 2. 지금 시·도 자동 저장 (데이터 절약 모드면 건너뜀, 세션마다 지역당 한 번만 시도)
  useEffect(() => {
    if (!currentRegion || !isOnline || autoTriedRef.current.has(currentRegion)) return undefined;
    if (navigator.connection?.saveData) return undefined;
    const current = readMeta();
    if (!isStale(current, `aed:${currentRegion}`) && !isStale(current, `shelter:${currentRegion}`)) return undefined;
    const timer = setTimeout(() => {
      autoTriedRef.current.add(currentRegion);
      download(currentRegion, { onlyStale: true });
    }, AUTO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [currentRegion, isOnline, download]);

  // 3. 오프라인 지도: 크기가 커서(지역당 수십 MB) 자동으로 받지 않고 안내 창에서 직접 받는다
  useEffect(() => {
    if (!mapAvailable || !isOnline) return;
    fetchMapManifest().then((m) => {
      if (!m?.regions) return;
      setMapSizes(Object.fromEntries(Object.entries(m.regions).map(([k, v]) => [k, v.bytes])));
    });
  }, [mapAvailable, isOnline]);

  // 앱이 업데이트된 뒤에도 지도 화면 코드·글꼴이 캐시에 남아 있도록, 지도를 저장한 사람만 온라인일 때 다시 불러 둔다
  const hasMaps = Object.keys(mapMeta).length > 0;
  useEffect(() => {
    if (!hasMaps || !isOnline) return undefined;
    const timer = setTimeout(() => warmOfflineMapAssets(), AUTO_DELAY_MS * 2);
    return () => clearTimeout(timer);
  }, [hasMaps, isOnline]);

  const downloadMap = useCallback(async (region) => {
    setMapFailedRegion(null);
    setMapProgress({ region, ratio: 0 });
    try {
      await downloadMapFile(region, (ratio) => setMapProgress({ region, ratio }));
    } catch (e) {
      setMapFailedRegion(region);
    } finally {
      setMapMeta(readMapMeta());
      setMapProgress(null);
    }
  }, []);

  const remove = useCallback(async (region) => {
    await Promise.all([removeRegion(region), removeMap(region)]);
    setMeta(readMeta());
    setMapMeta(readMapMeta());
  }, []);

  const mapRegionFor = useCallback((lat, lon) => findMapRegionFor(lat, lon, mapMeta), [mapMeta]);

  return {
    saved: listSavedRegions(meta),
    currentRegion,
    busyRegion,
    failedRegion,
    download,
    remove,
    mapAvailable,
    maps: mapMeta,
    mapSizes,
    mapProgress,
    mapFailedRegion,
    downloadMap,
    mapRegionFor,
  };
}
