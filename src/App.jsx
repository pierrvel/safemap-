import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RotateCw } from 'lucide-react';
import './v2.css';

import HeaderBar from './components/v2/HeaderBar';
import MapView from './components/v2/MapView';
import EmergencyBottomCard from './components/v2/EmergencyBottomCard';
import NavigationHUD from './components/v2/NavigationHUD';
import CprMetronomeModal from './components/v2/CprMetronomeModal';
import AuditModal from './components/v2/AuditModal';
import PwaInstallModal from './components/v2/PwaInstallModal';
import DataSourceModal from './components/v2/DataSourceModal';
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

const CACHE_KEY = 'goldenrunner_cached_facilities_v2';
// 현장 점검·제보 기능: 저장소(DB)와 제보 검증 체계가 갖춰지기 전까지 화면에서 숨김
const ENABLE_FIELD_AUDIT = false;
const REAL_ROUTE_TOP_N = 10;
const OFFLINE_CACHE_MAX_METERS = 10000;
const OFF_ROUTE_METERS = 50;
const OFF_ROUTE_GRACE_MS = 5000;

// 두 좌표 간 방위(8방향) 텍스트 — 오프라인으로 지도가 없을 때 방향 안내용
const DIRECTION_NAMES = ['북쪽', '북동쪽', '동쪽', '남동쪽', '남쪽', '남서쪽', '서쪽', '북서쪽'];
function getDirectionText(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return DIRECTION_NAMES[Math.round(bearing / 45) % 8];
}

// 오프라인 시 마지막 검색 결과(로컬 저장)를 현재 위치 기준으로 다시 계산 (10km 이내 결과만 사용)
function buildOfflineFacilities(lat, lon) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!cached?.facilities?.length || !cached.coords) return null;
    if (getDistanceMeters(lat, lon, cached.coords.lat, cached.coords.lon) > OFFLINE_CACHE_MAX_METERS) return null;
    return cached.facilities
      .map((f) => {
        const dist = Math.round(getDistanceMeters(lat, lon, f.lat, f.lon));
        return {
          ...f,
          distanceMeters: dist,
          walkingTime: `약 ${Math.max(1, Math.round(dist / 75))}분`,
          realDistanceMeters: undefined,
          realDurationText: undefined,
          direction: getDirectionText(lat, lon, f.lat, f.lon),
          // 저장 시점의 개방 여부는 지금과 다를 수 있음
          availableNow: f.available24h ? true : null,
        };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  } catch (e) {
    return null;
  }
}

// 🌟 [1] 두 좌표 간 거리(미터) 계산 유틸리티
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [category, setCategory] = useState('all'); // 'all' | 'aed' | 'shelter'
  const [openOnly, setOpenOnly] = useState(false); // 🌟 야간 폐문 헛걸음 방지 필터

  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [isCachedView, setIsCachedView] = useState(false);
  const [isOfflineView, setIsOfflineView] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  // 🌟 [1] 비동기 요청 번호 카운터: 가장 마지막에 보낸 요청의 응답만 화면에 반영
  const lastFacilitiesReqId = useRef(0);
  // 사용자가 지도·목록에서 직접 시설을 골랐는지 (실거리 재정렬 시 선택을 바꾸지 않기 위함)
  const userPickedFacilityRef = useRef(false);
  const handleUserSelectFacility = useCallback((fac) => {
    userPickedFacilityRef.current = true;
    setSelectedFacility(fac);
  }, []);

  // 내비게이션 상태
  const [isNavigating, setIsNavigating] = useState(false);
  const [navTarget, setNavTarget] = useState(null);
  const [navData, setNavData] = useState(null);
  // 길안내 중 실시간 이동 위치 (시설 재검색을 일으키지 않도록 coords와 분리)
  const [navPosition, setNavPosition] = useState(null);

  // 모달 및 토스트 상태
  const [showCprModal, setShowCprModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isCardExpanded, setIsCardExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // 📲 PWA 앱 설치 및 독립 실행(Standalone) 상태 관리
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  });
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  // 지도 카메라 및 '이 지역에서 재검색' 상태 (내 위치와 카메라 분리!)
  const [cameraCenter, setCameraCenter] = useState(null);
  const [showReSearchBtn, setShowReSearchBtn] = useState(false);

  // 길안내·CPR 중에는 화면이 꺼지지 않도록 유지
  useWakeLock(isNavigating || showCprModal);

  // 0. PWA 설치 이벤트 & 기기 환경 감지
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent.toLowerCase();
    const iosCheck = /iphone|ipad|ipod/.test(ua);
    const androidCheck = /android/.test(ua);
    setIsIos(iosCheck);
    setIsAndroid(androidCheck);

    // 안드로이드/PC 브라우저 네이티브 설치 프롬프트 인터셉트
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('[PWA] beforeinstallprompt event captured');
    };

    // 앱 설치 완료 이벤트
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setShowInstallModal(false);
      setToastMessage('🎉 골든러너 119 앱이 성공적으로 설치되었습니다!');
    };

    // 독립 창(Standalone) 모드 감지 리스너
    const mql = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = (e) => {
      if (e.matches) setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mql.addEventListener?.('change', handleDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mql.removeEventListener?.('change', handleDisplayChange);
    };
  }, []);

  // 네이티브 PWA 설치 실행 함수
  const handleInstallNative = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setToastMessage('📲 골든러너 119 앱을 설치하는 중입니다...');
        setDeferredPrompt(null);
        setShowInstallModal(false);
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
  };

  // 1. 서버 설정 조회
  useEffect(() => {
    fetchConfig().then((cfg) => {
      setConfig(cfg);
    });
  }, []);

  // 2. 카카오 지도 SDK 로더
  const { loaded: isKakaoLoaded, error: kakaoError } = useKakaoLoader(config?.kakaoMapApiKey);

  // 3. 실시간 GPS 지오로케이션
  const {
    coords,
    hasLocation,
    loading: isLocating,
    errorMsg: locationError,
    requestGps,
    setManualCoords,
  } = useGeolocation();

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
  }, []);

  // 4. 🌟 [1] 로컬 캐시: 위치가 확정되기 전에는 절대 캐시 항목을 현재 시설로 띄우지 않음!
  // 위치가 확정된 후 현재 위치와 200m 이내일 때만 '이전 결과'로 즉각 노출
  useEffect(() => {
    if (!coords.lat || !coords.lon) return;
    try {
      const cachedStr = localStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (cached?.coords?.lat && cached?.coords?.lon && cached?.facilities?.length > 0) {
          const dist = getDistanceMeters(coords.lat, coords.lon, cached.coords.lat, cached.coords.lon);
          if (dist <= 200) {
            // 저장 시점의 개방 여부는 지금과 다를 수 있으므로 5분이 지났으면 '운영시간 미확인'으로 표시
            const isStale = !cached.timestamp || Date.now() - cached.timestamp > 5 * 60 * 1000;
            const list = isStale
              ? cached.facilities.map((f) => (f.available24h ? f : { ...f, availableNow: null }))
              : cached.facilities;
            setFacilities(list);
            setSelectedFacility(list[0]);
            setIsCachedView(true);
          }
        }
      }
    } catch (e) {
      console.warn('Cache parsing failed:', e);
    }
  }, [coords.lat, coords.lon]);

  // 5. 시설 데이터 수집 및 비동기 OSRM 도로망 거리 보정
  const loadFacilities = useCallback(
    async (lat, lon, cat = category) => {
      if (!lat || !lon) return;

      // 🌟 [1] 요청마다 증가하는 시퀀스 번호 할당 (Race Condition 완벽 방지)
      const reqId = ++lastFacilitiesReqId.current;
      userPickedFacilityRef.current = false;

      const res = await fetchFacilities(lat, lon, cat, false);

      // 더 최신 요청이 이미 발생했으면 이전 응답은 폐기
      if (reqId !== lastFacilitiesReqId.current) {
        console.log(`[App] Stale facilities response ignored (${reqId} < ${lastFacilitiesReqId.current})`);
        return;
      }

      // 🌟 네트워크 장애 시: 마지막 검색 결과를 현재 GPS 위치 기준 거리·방향으로 다시 계산해 표시
      if (!res.success) {
        const offlineList = buildOfflineFacilities(lat, lon);
        if (offlineList) {
          setFacilities(offlineList);
          setSelectedFacility(offlineList[0]);
          setIsCachedView(true);
          setIsOfflineView(true);
          showToast('📴 네트워크 연결이 불안정해 마지막 검색 결과를 보여드려요.');
        } else {
          showToast('네트워크 연결을 확인해 주세요. 시설 정보를 불러오지 못했어요.');
        }
        return;
      }

      if (res.success && res.facilities) {
        const loadedList = res.facilities;
        setFacilities(loadedList);
        setIsCachedView(false);
        setIsOfflineView(false);

        if (loadedList.length > 0) {
          setSelectedFacility((prev) => {
            const found = loadedList.find((f) => f.id === prev?.id);
            return found || loadedList[0];
          });
        } else {
          setSelectedFacility(null);
        }

        // 로컬 캐시 갱신 (좌표 함께 저장)
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              coords: { lat, lon },
              facilities: loadedList,
              timestamp: Date.now(),
            })
          );
        } catch (e) {
          // ignore storage quota
        }

        // 🌟 직선거리 상위 10개 시설의 실제 도보 거리를 계산해 다시 정렬
        // (길이 막혀 돌아가야 하는 경우 직선상 1위가 실제로는 더 멀 수 있음)
        if (loadedList.length > 0) {
          const topCandidates = loadedList.slice(0, REAL_ROUTE_TOP_N).map((f) => ({
            id: f.id,
            lat: f.lat,
            lon: f.lon,
          }));

          fetchRouteMatrix({ lat, lon }, topCandidates).then((matrixRes) => {
            // matrix 응답 도착 시점에도 최신 요청인지 검증
            if (reqId !== lastFacilitiesReqId.current) return;
            if (!matrixRes.success || !matrixRes.results) return;

            const resMap = new Map(matrixRes.results.map((r) => [r.id, r]));
            const withReal = loadedList.map((f) => {
              const m = resMap.get(f.id);
              return m
                ? {
                    ...f,
                    realDistanceMeters: m.distanceMeters,
                    realDurationText: m.walkingTimeText,
                    isRealRoad: m.isRealRoad,
                  }
                : f;
            });

            // 실제 도로망 거리를 받은 경우에만 상위 그룹을 실제 거리순으로 재정렬
            const anyRealRoad = matrixRes.results.some((r) => r.isRealRoad);
            const reordered = anyRealRoad
              ? [
                  ...withReal
                    .slice(0, REAL_ROUTE_TOP_N)
                    .sort((a, b) => (a.realDistanceMeters ?? a.distanceMeters) - (b.realDistanceMeters ?? b.distanceMeters)),
                  ...withReal.slice(REAL_ROUTE_TOP_N),
                ]
              : withReal;

            setFacilities(reordered);
            setSelectedFacility((prev) => {
              // 사용자가 직접 고른 시설은 유지하고, 아니면 실제로 가장 가까운 시설로 교체
              if (!userPickedFacilityRef.current) return reordered[0];
              return reordered.find((f) => f.id === prev?.id) || prev;
            });
          });
        }
      }
    },
    [category]
  );

  useEffect(() => {
    if (coords.lat && coords.lon) {
      loadFacilities(coords.lat, coords.lon, category);
    }
  }, [coords.lat, coords.lon, category, loadFacilities]);

  // 네트워크 연결 상태 추적: 다시 연결되면 최신 시설 정보를 자동으로 다시 불러옴
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

  // 🌟 [5] '지금 개방' 필터 적용된 최종 목록 (알 수 없음(null)은 개방으로 취급하지 않고 확실한 true만 필터링)
  const displayedFacilities = useMemo(() => {
    if (!openOnly) return facilities;
    return facilities.filter((f) => f.availableNow === true);
  }, [facilities, openOnly]);

  // 🌟 선택 시설이 지금 이용 가능하지 않은 AED일 때, 지금 확실히 열려 있는 가장 가까운 AED를 대안으로 제시
  const openAedAlternative = useMemo(() => {
    const active = selectedFacility || displayedFacilities[0];
    if (!active || active.category !== 'aed' || active.availableNow === true) return null;
    return (
      facilities
        .filter((f) => f.category === 'aed' && f.availableNow === true && f.id !== active.id)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] || null
    );
  }, [facilities, selectedFacility, displayedFacilities]);

  // 카운트 계산
  const counts = useMemo(() => {
    const aeds = facilities.filter((f) => f.category === 'aed');
    return {
      total: facilities.length,
      aed: aeds.length,
      openAeds: aeds.filter((f) => f.availableNow === true).length,
      shelter: facilities.filter((f) => f.category === 'shelter').length,
    };
  }, [facilities]);

  // 장소 및 주소 검색
  const handleSearch = (keyword) => {
    if (!window.kakao?.maps?.services) {
      showToast('카카오 지도 검색 서비스를 준비 중입니다.');
      return;
    }

    setIsSearching(true);
    const places = new window.kakao.maps.services.Places();

    places.keywordSearch(keyword, (data, status) => {
      if (status === window.kakao.maps.services.Status.OK && data.length > 0) {
        const top = data[0];
        const newLat = parseFloat(top.y);
        const newLon = parseFloat(top.x);
        setManualCoords(newLat, newLon);
        setIsSearching(false);
        showToast(`📍 '${top.place_name}'(으)로 이동했습니다.`);
      } else {
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.addressSearch(keyword, (addrData, addrStatus) => {
          setIsSearching(false);
          if (addrStatus === window.kakao.maps.services.Status.OK && addrData.length > 0) {
            const top = addrData[0];
            const newLat = parseFloat(top.y);
            const newLon = parseFloat(top.x);
            setManualCoords(newLat, newLon);
            showToast(`📍 '${top.address_name}'(으)로 이동했습니다.`);
          } else {
            showToast(`'${keyword}' 검색 결과가 없습니다.`);
          }
        });
      }
    });
  };

  // 실시간 도보 내비게이션 시작
  const handleStartNavigation = async (targetFacility) => {
    // 🌟 [1] 위치 미확정 시 길안내 실행 원천 차단
    if (!coords.lat || !coords.lon) {
      showToast('현재 위치가 확정되지 않아 길안내를 시작할 수 없습니다. 상단에서 위치를 검색해 주세요.');
      return;
    }
    if (!targetFacility) return;
    setNavTarget(targetFacility);
    setIsNavigating(true);
    showToast(`🏃 '${targetFacility.name}' 도보 러닝 길안내를 시작합니다.`);

    const res = await fetchPedestrianDirections(
      { lat: coords.lat, lon: coords.lon },
      { lat: targetFacility.lat, lon: targetFacility.lon }
    );

    if (res.success) {
      setNavData(res);
    } else {
      // 직선 경로 폴백 (서버 응답과 같은 필드 구조 사용)
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

  const handleCloseNavigation = () => {
    setIsNavigating(false);
    setNavTarget(null);
    setNavData(null);
    setNavPosition(null);
    offRouteSinceRef.current = null;
    showToast('길안내를 종료했습니다.');
  };

  // 🌟 길안내 중 실시간 위치 추적 (이동에 따라 남은 거리·다음 안내 갱신)
  useEffect(() => {
    if (!isNavigating || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setNavPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => console.warn('Navigation watch error:', err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isNavigating]);

  // 🌟 경로 이탈 시 자동 재탐색: 경로에서 50m 이상 벗어난 상태가 5초 이상 이어지면 현재 위치에서 경로를 다시 요청
  // (직선 폴백 경로일 때는 30초마다 실제 도보 경로를 다시 시도)
  const offRouteSinceRef = useRef(null);
  const lastRerouteAtRef = useRef(0);
  const isReroutingRef = useRef(false);
  const navTargetIdRef = useRef(null);
  navTargetIdRef.current = navTarget?.id ?? null;

  useEffect(() => {
    if (!isNavigating || !navPosition || !navTarget || !navData?.coordinates?.length) return;

    const now = Date.now();
    const isFallbackRoute = navData.isRealRoad === false;

    if (!isFallbackRoute) {
      const minDist = Math.min(
        ...navData.coordinates.map((pt) =>
          getDistanceMeters(navPosition.lat, navPosition.lon, pt.lat, pt.lng)
        )
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
      // 응답 도착 전에 길안내가 종료되었거나 목적지가 바뀌었으면 무시
      if (navTargetIdRef.current !== targetId) return;
      if (res.success && res.isRealRoad) {
        setNavData(res);
        offRouteSinceRef.current = null;
        showToast(isFallbackRoute ? '🚶 실제 도보 경로를 찾았어요.' : '🔄 현재 위치에서 경로를 다시 찾았어요.');
      }
    });
  }, [isNavigating, navPosition, navTarget, navData, showToast]);

  // 🌟 핵심: 지도를 드래그했을 때 '내 위치'는 건드리지 않고 카메라 중심만 기록
  const handleCameraMove = useCallback((newCenter) => {
    setCameraCenter(newCenter);
    setShowReSearchBtn(true);
  }, []);

  // 🌟 사용자가 원할 때만 현 지도 중심으로 안전시설 재탐색 (내 위치는 보존!)
  const handleReSearchInArea = () => {
    if (cameraCenter) {
      loadFacilities(cameraCenter.lat, cameraCenter.lon, category);
      setShowReSearchBtn(false);
      showToast('📍 현 지도 위치 주변 시설을 새로 탐색했습니다.');
    }
  };

  // 현재 표시할 1순위 시설
  const activeFacility = selectedFacility || displayedFacilities[0] || null;

  return (
    <div className="v2-app-container">
      {/* 1. 전체 화면 지도 */}
      <MapView
        isLoaded={isKakaoLoaded}
        unavailableMessage={
          !isKakaoLoaded && (kakaoError || !isOnline)
            ? '지도를 불러올 수 없어요. 아래 목록의 거리·방향을 참고해 이동하세요.'
            : null
        }
        userCoords={(isNavigating && navPosition) || coords}
        facilities={displayedFacilities}
        selectedFacility={activeFacility}
        onSelectFacility={handleUserSelectFacility}
        navRouteCoordinates={navData?.coordinates || null}
        onCameraMove={handleCameraMove}
        onRequestGps={() => {
          requestGps(true);
          setShowReSearchBtn(false);
          showToast('내 GPS 위치로 지도를 이동합니다.');
        }}
      />

      {/* 2. 상단 미니멀 검색 & 필터 헤더 */}
      {!isNavigating && (
        <HeaderBar
          category={category}
          onSelectCategory={(cat) => setCategory(cat)}
          openOnly={openOnly}
          onToggleOpenOnly={() => setOpenOnly((prev) => !prev)}
          counts={counts}
          onSearch={handleSearch}
          onResetGps={() => {
            requestGps(true);
            setShowReSearchBtn(false);
            showToast('내 위치로 지도를 이동합니다.');
          }}
          isSearching={isSearching}
          isStandalone={isStandalone}
          onOpenInstallModal={() => setShowInstallModal(true)}
          onOpenInfo={() => setShowInfoModal(true)}
        />
      )}

      {/* 2.5 🌟 현 지도 중심 재검색 플로팅 버튼 (지도를 움직여도 내 위치 핀은 고정!) */}
      {showReSearchBtn && !isNavigating && (
        <button
          type="button"
          className="v2-btn-re-search-pill"
          onClick={handleReSearchInArea}
          title="현재 보고 있는 지도 중심으로 안전시설 다시 찾기"
        >
          <RotateCw size={13} />
          <span>이 지역에서 재검색</span>
        </button>
      )}

      {/* 3. 🌟 하단 긴급 카드 (도보 길안내 히어로 버튼 & 주변 시설 리스트 포함) */}
      {!isNavigating && (
        <EmergencyBottomCard
          facility={activeFacility}
          facilities={displayedFacilities}
          isNearest={activeFacility?.id === displayedFacilities[0]?.id}
          onStartNavigation={handleStartNavigation}
          onOpenCpr={() => setShowCprModal(true)}
          onOpenAudit={ENABLE_FIELD_AUDIT ? () => setShowAuditModal(true) : undefined}
          onSelectFacility={handleUserSelectFacility}
          openAedAlternative={openAedAlternative}
          isExpanded={isCardExpanded}
          onToggleExpand={() => setIsCardExpanded((prev) => !prev)}
          isLocating={isLocating}
          locationError={locationError}
          onRetryLocation={() => requestGps(true)}
          isCachedView={isCachedView}
          isOfflineView={isOfflineView}
        />
      )}

      {/* 4. 실시간 도보 내비게이션 HUD */}
      {isNavigating && navTarget && (
        <NavigationHUD
          navData={navData}
          destination={navTarget}
          currentPosition={navPosition}
          onClose={handleCloseNavigation}
        />
      )}

      {/* 5. 105 BPM CPR 메트로놈 & 선한 사마리아인 법률 보호 모달 */}
      <CprMetronomeModal
        isOpen={showCprModal}
        onClose={() => setShowCprModal(false)}
      />

      {/* 6. 시민 참여 AED 현장 실사 점검 모달 */}
      <AuditModal
        facility={activeFacility}
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        onSuccess={(msg) => showToast(msg)}
      />

      {/* 6.5 📲 PWA 앱 설치 안내 및 네이티브 설치 모달 */}
      <PwaInstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        deferredPrompt={deferredPrompt}
        onInstallNative={handleInstallNative}
        isIos={isIos}
        isAndroid={isAndroid}
      />

      {/* 6.7 ℹ️ [7] 데이터 출처·기준일 및 필수 응급 주의사항 모달 */}
      <DataSourceModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
      />

      {/* 7. 토스트 알림 */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}
