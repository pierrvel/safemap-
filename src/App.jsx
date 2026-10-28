import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RotateCw } from 'lucide-react';
import './v2.css';

import HeaderBar from './components/v2/HeaderBar';
import MapView from './components/v2/MapView';
import EmergencyBottomCard from './components/v2/EmergencyBottomCard';
import NavigationHUD from './components/v2/NavigationHUD';
import CprMetronomeModal from './components/v2/CprMetronomeModal';
import AuditModal from './components/v2/AuditModal';
import PwaInstallModal from './components/v2/PwaInstallModal';
import Toast from './components/Toast';

import { useKakaoLoader } from './hooks/useKakaoLoader';
import { useGeolocation } from './hooks/useGeolocation';
import {
  fetchConfig,
  fetchFacilities,
  fetchPedestrianDirections,
  fetchRouteMatrix,
} from './services/api';

const CACHE_KEY = 'goldenrunner_cached_facilities_v2';

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

  // 🌟 [1] 비동기 요청 번호 카운터: 가장 마지막에 보낸 요청의 응답만 화면에 반영
  const lastFacilitiesReqId = useRef(0);

  // 내비게이션 상태
  const [isNavigating, setIsNavigating] = useState(false);
  const [navTarget, setNavTarget] = useState(null);
  const [navData, setNavData] = useState(null);

  // 모달 및 토스트 상태
  const [showCprModal, setShowCprModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
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
            setFacilities(cached.facilities);
            setSelectedFacility(cached.facilities[0]);
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

      const res = await fetchFacilities(lat, lon, cat, false);

      // 더 최신 요청이 이미 발생했으면 이전 응답은 폐기
      if (reqId !== lastFacilitiesReqId.current) {
        console.log(`[App] Stale facilities response ignored (${reqId} < ${lastFacilitiesReqId.current})`);
        return;
      }

      if (res.success && res.facilities) {
        const loadedList = res.facilities;
        setFacilities(loadedList);
        setIsCachedView(false);

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

        // 상위 3개 핵심 시설 OSRM 도로망 실거리 정밀 보정
        if (loadedList.length > 0) {
          const topCandidates = loadedList.slice(0, 3).map((f) => ({
            id: f.id,
            lat: f.lat,
            lon: f.lon,
          }));

          fetchRouteMatrix({ lat, lon }, topCandidates).then((matrixRes) => {
            // matrix 응답 도착 시점에도 최신 요청인지 검증
            if (reqId !== lastFacilitiesReqId.current) return;

            if (matrixRes.success && matrixRes.results) {
              const resMap = new Map(matrixRes.results.map((r) => [r.id, r]));
              setFacilities((prev) =>
                prev.map((f) => {
                  const m = resMap.get(f.id);
                  if (m) {
                    return {
                      ...f,
                      realDistanceMeters: m.distanceMeters,
                      realDurationText: m.walkingTimeText,
                      isRealRoad: m.isRealRoad,
                    };
                  }
                  return f;
                })
              );

              setSelectedFacility((prev) => {
                if (!prev) return prev;
                const m = resMap.get(prev.id);
                return m
                  ? {
                      ...prev,
                      realDistanceMeters: m.distanceMeters,
                      realDurationText: m.walkingTimeText,
                      isRealRoad: m.isRealRoad,
                    }
                  : prev;
              });
            }
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

  // '지금 개방' 필터 적용된 최종 목록
  const displayedFacilities = useMemo(() => {
    if (!openOnly) return facilities;
    return facilities.filter((f) => f.availableNow !== false);
  }, [facilities, openOnly]);

  // 카운트 계산
  const counts = useMemo(() => {
    const aeds = facilities.filter((f) => f.category === 'aed');
    return {
      total: facilities.length,
      aed: aeds.length,
      openAeds: aeds.filter((f) => f.availableNow !== false).length,
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
      // 직선 경로 폴백
      setNavData({
        coordinates: [
          [coords.lon, coords.lat],
          [targetFacility.lon, targetFacility.lat],
        ],
        totalDistanceMeters: targetFacility.distanceMeters,
        durationMinutes: Math.max(1, Math.round(targetFacility.distanceMeters / 75)),
      });
    }
  };

  const handleCloseNavigation = () => {
    setIsNavigating(false);
    setNavTarget(null);
    setNavData(null);
    showToast('길안내를 종료했습니다.');
  };

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
        userCoords={coords}
        facilities={displayedFacilities}
        selectedFacility={activeFacility}
        onSelectFacility={(fac) => setSelectedFacility(fac)}
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
          onOpenAudit={() => setShowAuditModal(true)}
          onSelectFacility={(fac) => setSelectedFacility(fac)}
          isExpanded={isCardExpanded}
          onToggleExpand={() => setIsCardExpanded((prev) => !prev)}
          isLocating={isLocating}
          locationError={locationError}
          isCachedView={isCachedView}
        />
      )}

      {/* 4. 실시간 도보 내비게이션 HUD */}
      {isNavigating && navTarget && (
        <NavigationHUD
          navData={navData}
          destination={navTarget}
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

      {/* 7. 토스트 알림 */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}
