import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RotateCw } from 'lucide-react';
import './safemap.css';

import HeaderBar from './components/v2/HeaderBar';
import MapView from './components/v2/MapView';
import EmergencyBottomCard from './components/v2/EmergencyBottomCard';
import NavigationHUD from './components/v2/NavigationHUD';
import CprMetronomeModal from './components/v2/CprMetronomeModal';
import AuditModal from './components/v2/AuditModal';
import PwaInstallModal from './components/v2/PwaInstallModal';
import DataSourceModal from './components/v2/DataSourceModal';
import LocationScreen from './components/v2/LocationScreen';
import Toast from './components/Toast';

import { useKakaoLoader } from './hooks/useKakaoLoader';
import { useGeolocation } from './hooks/useGeolocation';
import { useWakeLock } from './hooks/useWakeLock';
import {
  fetchConfig,
  fetchFacilities,
  fetchPedestrianDirections,
  fetchRouteMatrix,
} from './services/api';
import { pickDefaultFacility, walkSeconds, walkMinutes, placeTitle, placeOwner, getDirectionText } from './utils/format';

// 오프라인 대비 마지막 검색 결과: 대피소를 봐도 AED 결과가 지워지지 않게 종류별로 따로 저장
const CACHE_KEY = 'safemap_cached_facilities_v4';
const LEGACY_CACHE_KEY = 'safemap_cached_facilities_v3';
// 현장 점검·제보 기능: 저장소(DB)와 제보 검증 체계가 갖춰지기 전까지 화면에서 숨김
const ENABLE_FIELD_AUDIT = false;
const REAL_ROUTE_TOP_N = 10;
// 실제 도보 거리 계산을 기다리는 최대 시간: 이후에는 추정값으로 먼저 답하고, 답을 바꾸지 않는다
const ANSWER_WAIT_MS = 1500;
const OFFLINE_CACHE_MAX_METERS = 10000;
const OFF_ROUTE_METERS = 50;
const OFF_ROUTE_GRACE_MS = 5000;
const WIDE_QUERY = '(min-width: 900px)';

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function readOfflineCache() {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (store) return store;
    // 예전 형식(종류 하나만 저장)은 해당 종류 칸으로 옮겨 읽는다
    const legacy = JSON.parse(localStorage.getItem(LEGACY_CACHE_KEY) || 'null');
    return legacy?.category ? { [legacy.category]: legacy } : {};
  } catch (e) {
    return {};
  }
}

function saveOfflineCache(category, entry) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readOfflineCache(), [category]: entry }));
    localStorage.removeItem(LEGACY_CACHE_KEY);
  } catch (e) {
    // 저장 공간 부족은 무시
  }
}

// 오프라인 시 마지막 검색 결과(로컬 저장)를 현재 위치 기준으로 다시 계산 (10km 이내, 같은 종류만)
function buildOfflineFacilities(lat, lon, category) {
  try {
    const cached = readOfflineCache()[category];
    if (!cached?.facilities?.length || !cached.coords) return null;
    if (getDistanceMeters(lat, lon, cached.coords.lat, cached.coords.lon) > OFFLINE_CACHE_MAX_METERS) return null;
    return cached.facilities
      .map((f) => ({
        ...f,
        distanceMeters: Math.round(getDistanceMeters(lat, lon, f.lat, f.lon)),
        realDistanceMeters: undefined,
        realDurationSeconds: undefined,
        direction: getDirectionText(lat, lon, f.lat, f.lon),
        // 저장 시점의 개방 여부는 지금과 다를 수 있음
        availableNow: f.available24h ? true : null,
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  } catch (e) {
    return null;
  }
}

// 실제 도보 거리 결과를 목록에 합친다 (순서는 바꾸지 않음)
function mergeRouteResults(list, results) {
  const resMap = new Map(results.map((r) => [r.id, r]));
  return list.map((f) => {
    const m = resMap.get(f.id);
    if (!m) return f;
    return {
      ...f,
      realDistanceMeters: m.distanceMeters,
      realDurationSeconds: m.isRealRoad ? m.durationSeconds : undefined,
      isRealRoad: m.isRealRoad,
    };
  });
}

// 상위 후보를 실제 도보 거리순으로 정렬 (답을 그리기 전에만 사용)
function sortTopByWalk(list) {
  return [
    ...list.slice(0, REAL_ROUTE_TOP_N).sort((a, b) => walkSeconds(a) - walkSeconds(b)),
    ...list.slice(REAL_ROUTE_TOP_N),
  ];
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [category, setCategory] = useState('aed');
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [answerReady, setAnswerReady] = useState(false);
  const [isOfflineView, setIsOfflineView] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [previewRoute, setPreviewRoute] = useState(null);
  const [sheetHeight, setSheetHeight] = useState(360);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(WIDE_QUERY).matches);

  // 가장 마지막에 보낸 요청의 응답만 화면에 반영
  const lastFacilitiesReqId = useRef(0);
  const answerReadyRef = useRef(false);
  answerReadyRef.current = answerReady;
  const userPickedFacilityRef = useRef(false);
  const handleUserSelectFacility = useCallback((fac) => {
    userPickedFacilityRef.current = true;
    setSelectedFacility(fac);
  }, []);

  // 길안내
  const [isNavigating, setIsNavigating] = useState(false);
  const [navTarget, setNavTarget] = useState(null);
  const [navData, setNavData] = useState(null);
  const [navPosition, setNavPosition] = useState(null);
  const [hasArrived, setHasArrived] = useState(false);

  // 대화상자·알림
  const [showCprModal, setShowCprModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // 홈 화면 설치
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  });
  const isIos = useMemo(() => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent), []);

  // 지도 카메라 (내 위치와 분리)
  const [cameraCenter, setCameraCenter] = useState(null);
  const [showReSearchBtn, setShowReSearchBtn] = useState(false);

  // 길안내·CPR 중에는 화면이 꺼지지 않도록 유지
  useWakeLock(isNavigating || showCprModal);

  const showToast = useCallback((msg) => setToastMessage(msg), []);

  // 넓은 화면 여부 (시트가 왼쪽 패널이 됨)
  useEffect(() => {
    const mql = window.matchMedia(WIDE_QUERY);
    const onChange = (e) => setIsWide(e.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  // 홈 화면 바로가기 (manifest shortcuts)
  useEffect(() => {
    const action = new URLSearchParams(window.location.search).get('action');
    if (action === 'cpr') setShowCprModal(true);
  }, []);

  // 홈 화면 설치 이벤트
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setShowInstallModal(false);
      setToastMessage('홈 화면에 세이프맵을 추가했어요.');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallNative = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowInstallModal(false);
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
  };

  useEffect(() => {
    fetchConfig().then(setConfig);
  }, []);

  const { loaded: isKakaoLoaded, error: kakaoError } = useKakaoLoader(config?.kakaoMapApiKey);
  const { coords, status: geoStatus, hasLocation, requestGps, setManualCoords } = useGeolocation();

  // 시설 수집 → 실제 도보 거리로 상위 후보 정렬 → 답 하나를 정해 한 번만 그린다
  const loadFacilities = useCallback(
    async (lat, lon, cat) => {
      if (!lat || !lon) return;
      const reqId = ++lastFacilitiesReqId.current;
      userPickedFacilityRef.current = false;
      setAnswerReady(false);
      setPreviewRoute(null);

      const res = await fetchFacilities(lat, lon, cat, false);
      if (reqId !== lastFacilitiesReqId.current) return;

      // 네트워크 장애: 마지막 결과를 현재 위치 기준 거리·방향으로 다시 계산
      if (!res.success) {
        const offlineList = buildOfflineFacilities(lat, lon, cat);
        setFacilities(offlineList || []);
        setSelectedFacility(offlineList ? pickDefaultFacility(offlineList) : null);
        setIsOfflineView(!!offlineList);
        setAnswerReady(true);
        if (!offlineList) showToast('인터넷 연결을 확인해 주세요. 시설 정보를 불러오지 못했어요.');
        return;
      }

      const list = res.facilities || [];
      setFacilities(list);
      setIsOfflineView(false);

      saveOfflineCache(cat, { coords: { lat, lon }, category: cat, facilities: list, timestamp: Date.now() });

      if (list.length === 0) {
        setSelectedFacility(null);
        setAnswerReady(true);
        return;
      }

      const matrixPromise = fetchRouteMatrix(
        { lat, lon },
        list.slice(0, REAL_ROUTE_TOP_N).map((f) => ({ id: f.id, lat: f.lat, lon: f.lon }))
      ).then((m) => (m.success && m.results?.length ? mergeRouteResults(list, m.results) : null));

      const first = await Promise.race([
        matrixPromise,
        new Promise((resolve) => setTimeout(() => resolve('timeout'), ANSWER_WAIT_MS)),
      ]);
      if (reqId !== lastFacilitiesReqId.current) return;

      if (first && first !== 'timeout') {
        const sorted = sortTopByWalk(first);
        setFacilities(sorted);
        setSelectedFacility(pickDefaultFacility(sorted));
        setAnswerReady(true);
        return;
      }

      // 시간 안에 못 받으면 추정값으로 먼저 답하고, 나중 결과는 숫자만 고친다 (순서·선택은 그대로)
      setSelectedFacility(pickDefaultFacility(list));
      setAnswerReady(true);
      matrixPromise.then((merged) => {
        if (!merged || reqId !== lastFacilitiesReqId.current) return;
        setFacilities(merged);
        setSelectedFacility((prev) => merged.find((f) => f.id === prev?.id) || prev);
      });
    },
    [showToast]
  );

  useEffect(() => {
    if (coords.lat && coords.lon) loadFacilities(coords.lat, coords.lon, category);
  }, [coords.lat, coords.lon, category, loadFacilities]);

  // 다시 연결되면 최신 시설 정보를 다시 불러옴
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (coords.lat && coords.lon) loadFacilities(coords.lat, coords.lon, category);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [coords.lat, coords.lon, category, loadFacilities]);

  // 선택한 AED가 확실히 열려 있지 않으면, 확실히 열린 가장 가까운 AED를 함께 제안
  const openAlternative = useMemo(() => {
    const active = selectedFacility;
    if (!active || active.category !== 'aed' || active.availableNow === true) return null;
    return (
      facilities
        .filter((f) => f.category === 'aed' && f.availableNow === true && f.id !== active.id)
        .sort((a, b) => walkSeconds(a) - walkSeconds(b))[0] || null
    );
  }, [facilities, selectedFacility]);

  // 첫 화면 경로 미리보기: 선택한 시설까지의 걷는 길 + 시간 말풍선
  const routeCacheRef = useRef(new Map());
  useEffect(() => {
    if (!answerReady || !selectedFacility || isNavigating || !coords.lat || isOfflineView) {
      setPreviewRoute(null);
      return undefined;
    }
    let cancelled = false;
    const fac = selectedFacility;
    const key = `${fac.id}|${coords.lat.toFixed(4)}|${coords.lon.toFixed(4)}`;
    const show = (res) => {
      if (cancelled) return;
      const isReal = res.isRealRoad !== false && Number.isFinite(res.durationSeconds);
      // 지도에 그린 실제 걷는 길과 카드의 시간·거리가 어긋나지 않게, 실측 경로 값으로 숫자만 고친다 (답은 그대로)
      if (isReal && (fac.realDistanceMeters !== res.distanceMeters || fac.realDurationSeconds !== res.durationSeconds)) {
        const patch = (f) =>
          f.id === fac.id
            ? { ...f, realDistanceMeters: res.distanceMeters, realDurationSeconds: res.durationSeconds, isRealRoad: true }
            : f;
        setFacilities((prev) => prev.map(patch));
        setSelectedFacility((prev) => (prev?.id === fac.id ? patch(prev) : prev));
      }
      const minutes = isReal ? Math.max(1, Math.round(res.durationSeconds / 60)) : walkMinutes(fac);
      setPreviewRoute({ coordinates: res.coordinates, label: `도보 약 ${minutes}분`, isEstimate: !isReal });
    };
    const cached = routeCacheRef.current.get(key);
    if (cached) {
      show(cached);
    } else {
      fetchPedestrianDirections({ lat: coords.lat, lon: coords.lon }, { lat: fac.lat, lon: fac.lon }).then((res) => {
        if (!res.success || !res.coordinates?.length) return;
        routeCacheRef.current.set(key, res);
        show(res);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [answerReady, selectedFacility, isNavigating, coords.lat, coords.lon, isOfflineView]);

  // 장소·주소 검색
  const handleSearch = (keyword) => {
    if (!window.kakao?.maps?.services) {
      showToast('지도 검색을 준비하고 있어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setIsSearching(true);
    const places = new window.kakao.maps.services.Places();
    places.keywordSearch(keyword, (data, status) => {
      if (status === window.kakao.maps.services.Status.OK && data.length > 0) {
        setManualCoords(parseFloat(data[0].y), parseFloat(data[0].x));
        setIsSearching(false);
        showToast(`'${data[0].place_name}' 주변을 찾을게요.`);
        return;
      }
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.addressSearch(keyword, (addrData, addrStatus) => {
        setIsSearching(false);
        if (addrStatus === window.kakao.maps.services.Status.OK && addrData.length > 0) {
          setManualCoords(parseFloat(addrData[0].y), parseFloat(addrData[0].x));
          showToast(`'${addrData[0].address_name}' 주변을 찾을게요.`);
        } else {
          showToast(`'${keyword}'을(를) 찾지 못했어요. 다른 이름으로 검색해 주세요.`);
        }
      });
    });
  };

  // 옆 사람에게 위치 보내기: 공유 창이 있으면 공유, 없으면 링크 복사
  const handleShare = async (fac) => {
    const where = placeTitle(fac);
    const owner = placeOwner(fac);
    const url = `https://map.kakao.com/link/map/${encodeURIComponent(where)},${fac.lat},${fac.lon}`;
    const text =
      fac.category === 'aed'
        ? `AED를 가져와 주세요. ${where}${owner ? ` (${owner})` : ''}에 있어요. 걸어서 약 ${walkMinutes(fac)}분.`
        : `대피소 위치예요. ${where}${owner ? ` (${owner})` : ''}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: fac.category === 'aed' ? 'AED 위치' : '대피소 위치', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      showToast('위치를 복사했어요. 메시지로 보내 주세요.');
    } catch (err) {
      if (err?.name !== 'AbortError') showToast('공유하지 못했어요. 화면의 위치를 직접 알려 주세요.');
    }
  };

  // 실시간 도보 길안내
  const handleStartNavigation = async (targetFacility) => {
    if (!coords.lat || !coords.lon) {
      showToast('현재 위치를 몰라 길안내를 시작할 수 없어요. 위치를 먼저 지정해 주세요.');
      return;
    }
    if (!targetFacility) return;
    setNavTarget(targetFacility);
    setIsNavigating(true);

    const res = await fetchPedestrianDirections(
      { lat: coords.lat, lon: coords.lon },
      { lat: targetFacility.lat, lon: targetFacility.lon }
    );
    if (res.success) {
      setNavData(res);
    } else {
      const estDist = Math.round(targetFacility.distanceMeters * 1.25);
      setNavData({
        isRealRoad: false,
        coordinates: [
          { lat: coords.lat, lng: coords.lon },
          { lat: targetFacility.lat, lng: targetFacility.lon },
        ],
        distanceMeters: estDist,
        durationSeconds: Math.round(estDist / 1.25),
        steps: [],
      });
    }
  };

  const offRouteSinceRef = useRef(null);
  const lastRerouteAtRef = useRef(0);
  const isReroutingRef = useRef(false);
  const navTargetIdRef = useRef(null);
  navTargetIdRef.current = navTarget?.id ?? null;

  const handleCloseNavigation = () => {
    setIsNavigating(false);
    setNavTarget(null);
    setNavData(null);
    setNavPosition(null);
    setHasArrived(false);
    offRouteSinceRef.current = null;
  };

  // 길안내 중 실시간 위치 추적
  useEffect(() => {
    if (!isNavigating || !navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setNavPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => console.warn('Navigation watch error:', err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isNavigating]);

  // 경로에서 50m 이상 5초간 벗어나면 현재 위치에서 다시 찾기 (직선 폴백이면 30초마다 실제 경로 재시도)
  useEffect(() => {
    if (!isNavigating || !navPosition || !navTarget || !navData?.coordinates?.length) return;

    const now = Date.now();
    const isFallbackRoute = navData.isRealRoad === false;

    if (!isFallbackRoute) {
      const minDist = Math.min(
        ...navData.coordinates.map((pt) => getDistanceMeters(navPosition.lat, navPosition.lon, pt.lat, pt.lng))
      );
      if (minDist <= OFF_ROUTE_METERS) {
        offRouteSinceRef.current = null;
        return;
      }
      if (!offRouteSinceRef.current) {
        offRouteSinceRef.current = now;
        return;
      }
      if (now - offRouteSinceRef.current < OFF_ROUTE_GRACE_MS) return;
    }

    const minInterval = isFallbackRoute ? 30000 : 15000;
    if (isReroutingRef.current || now - lastRerouteAtRef.current < minInterval) return;

    isReroutingRef.current = true;
    lastRerouteAtRef.current = now;
    const targetId = navTarget.id;

    fetchPedestrianDirections(
      { lat: navPosition.lat, lon: navPosition.lon },
      { lat: navTarget.lat, lon: navTarget.lon }
    ).then((res) => {
      isReroutingRef.current = false;
      if (navTargetIdRef.current !== targetId) return;
      if (res.success && res.isRealRoad) {
        setNavData(res);
        offRouteSinceRef.current = null;
        showToast(isFallbackRoute ? '걷는 길을 찾았어요.' : '지금 위치에서 길을 다시 찾았어요.');
      }
    });
  }, [isNavigating, navPosition, navTarget, navData, showToast]);

  // 지도를 끌면 내 위치는 그대로 두고 카메라 중심만 기록
  const handleCameraMove = useCallback((newCenter) => {
    setCameraCenter(newCenter);
    setShowReSearchBtn(true);
  }, []);

  const handleReSearchInArea = () => {
    if (!cameraCenter) return;
    loadFacilities(cameraCenter.lat, cameraCenter.lon, category);
    setShowReSearchBtn(false);
  };

  const handleRequestGps = () => {
    requestGps(true);
    setShowReSearchBtn(false);
  };

  const handleSheetHeight = useCallback((h) => setSheetHeight(Math.round(h)), []);

  const showLocationScreen = !hasLocation && (geoStatus === 'prompt' || geoStatus === 'denied');
  const kindText = category === 'aed' ? 'AED' : '대피소';

  return (
    <div className="sm-app">
      <MapView
        isLoaded={isKakaoLoaded}
        unavailableMessage={
          !isNavigating && !isKakaoLoaded && (kakaoError || !isOnline)
            ? '지도를 불러오지 못했어요. 아래에 적힌 방향과 거리를 보고 이동해 주세요.'
            : null
        }
        userCoords={(isNavigating && navPosition) || coords}
        facilities={facilities}
        selectedFacility={isNavigating ? navTarget : selectedFacility}
        onSelectFacility={handleUserSelectFacility}
        navRouteCoordinates={navData?.coordinates || null}
        previewRoute={previewRoute}
        emphasizeAll={sheetCollapsed && !isNavigating}
        focusPoints={isNavigating && hasArrived && navPosition && navTarget ? [navPosition, navTarget] : null}
        bottomOffset={isWide || showLocationScreen ? 0 : sheetHeight}
        leftInset={isWide ? 416 : 0}
        onCameraMove={handleCameraMove}
        onRequestGps={handleRequestGps}
        showControls={!showLocationScreen}
      />

      {!isNavigating && (
        <HeaderBar
          category={category}
          onSelectCategory={setCategory}
          onSearch={handleSearch}
          isSearching={isSearching}
          onOpenInfo={() => setShowInfoModal(true)}
        />
      )}

      {showReSearchBtn && !isNavigating && (
        <button type="button" className="sm-research" onClick={handleReSearchInArea}>
          <RotateCw size={16} strokeWidth={2.4} aria-hidden="true" />
          이 지역에서 {kindText} 다시 찾기
        </button>
      )}

      {!isNavigating && hasLocation && (
        <EmergencyBottomCard
          category={category}
          facility={selectedFacility}
          facilities={facilities}
          answerReady={answerReady}
          onStartNavigation={handleStartNavigation}
          onOpenCpr={() => setShowCprModal(true)}
          onShare={handleShare}
          onSelectFacility={handleUserSelectFacility}
          openAlternative={openAlternative}
          isOfflineView={isOfflineView}
          onHeightChange={handleSheetHeight}
          onCollapsedChange={setSheetCollapsed}
        />
      )}

      {!isNavigating && !hasLocation && !showLocationScreen && (
        <EmergencyBottomCard
          category={category}
          answerReady={false}
          onOpenCpr={() => setShowCprModal(true)}
          onHeightChange={handleSheetHeight}
        />
      )}

      {isNavigating && navTarget && (
        <NavigationHUD
          navData={navData}
          destination={navTarget}
          currentPosition={navPosition || coords}
          onClose={handleCloseNavigation}
          onOpenCpr={() => setShowCprModal(true)}
          onHeightChange={handleSheetHeight}
          onArrivedChange={setHasArrived}
        />
      )}

      {showLocationScreen && (
        <LocationScreen
          status={geoStatus}
          onAllow={() => requestGps(true)}
          onSearch={handleSearch}
          isSearching={isSearching}
          onOpenCpr={() => setShowCprModal(true)}
        />
      )}

      <CprMetronomeModal isOpen={showCprModal} onClose={() => setShowCprModal(false)} />

      {ENABLE_FIELD_AUDIT && (
        <AuditModal
          facility={selectedFacility}
          isOpen={showAuditModal}
          onClose={() => setShowAuditModal(false)}
          onSuccess={showToast}
        />
      )}

      <PwaInstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        deferredPrompt={deferredPrompt}
        onInstallNative={handleInstallNative}
        isIos={isIos}
      />

      <DataSourceModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        onOpenInstall={
          isStandalone
            ? undefined
            : () => {
                setShowInfoModal(false);
                setShowInstallModal(true);
              }
        }
      />

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}
