import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import KakaoMap from './components/KakaoMap';
import BottomSheet from './components/BottomSheet';
import InAppNavigation from './components/InAppNavigation';
import ClusterModal from './components/ClusterModal';
import ReportModal from './components/ReportModal';
import StatsModal from './components/StatsModal';
import SystemInfoModal from './components/SystemInfoModal';
import Toast from './components/Toast';

import { useKakaoLoader } from './hooks/useKakaoLoader';
import { useGeolocation } from './hooks/useGeolocation';
import {
  fetchConfig,
  fetchFacilities,
  fetchPedestrianDirections,
  fetchRouteMatrix,
  submitReport,
} from './services/api';

export default function App() {
  const [config, setConfig] = useState(null);
  const [category, setCategory] = useState('all');
  const [verifiedOnly, setVerifiedOnly] = useState(true);

  const [facilities, setFacilities] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedFacility, setSelectedFacility] = useState(null);

  // 내비게이션 상태
  const [isNavigating, setIsNavigating] = useState(false);
  const [navTarget, setNavTarget] = useState(null);
  const [navData, setNavData] = useState(null);

  // 모달 및 토스트 상태
  const [clusterModalData, setClusterModalData] = useState(null);
  const [reportModalData, setReportModalData] = useState(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showSystemInfoModal, setShowSystemInfoModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // 바텀시트 접힘/펼침 상태
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // 1. 서버 환경설정 조회
  useEffect(() => {
    fetchConfig().then((cfg) => {
      setConfig(cfg);
    });
  }, []);

  // 2. 카카오 SDK 로더 훅
  const { loaded: isKakaoLoaded, error: kakaoError } = useKakaoLoader(config?.kakaoMapApiKey);

  // 3. 지오로케이션(GPS) 훅
  const { coords, isLiveGps, requestGps, setManualCoords } = useGeolocation();

  // 토스트 도우미
  const showToast = useCallback((msg) => {
    setToastMessage(msg);
  }, []);

  // 4. 시설 데이터 불러오기 및 도보 매트릭스 보정
  const loadFacilities = useCallback(
    async (lat, lon, cat = category, verified = verifiedOnly) => {
      const res = await fetchFacilities(lat, lon, cat, verified);
      if (res.success && res.facilities) {
        let loadedList = res.facilities;
        setStats(res.stats || null);

        // 최단거리 1등 시설 기본 선택
        if (loadedList.length > 0) {
          setSelectedFacility(loadedList[0]);
        }

        setFacilities(loadedList);

        // 도보 실거리 매트릭스 비동기 보정 (OSRM 도로망 연동)
        if (loadedList.length > 0) {
          const matrixTargets = loadedList.slice(0, 15).map((f) => ({
            id: f.id,
            lat: f.lat,
            lon: f.lon,
          }));

          fetchRouteMatrix({ lat, lon }, matrixTargets).then((matrixRes) => {
            if (matrixRes.success && matrixRes.results) {
              const resMap = new Map(matrixRes.results.map((r) => [r.id, r]));
              setFacilities((prev) =>
                prev.map((f) => {
                  const m = resMap.get(f.id);
                  if (m) {
                    return {
                      ...f,
                      realDistanceMeters: m.distanceMeters,
                      realDurationSeconds: m.durationSeconds,
                      realDurationText: m.walkingTimeText,
                      isRealRoad: m.isRealRoad,
                    };
                  }
                  return f;
                })
              );
            }
          });
        }
      } else {
        showToast('주변 안전시설 데이터를 불러오지 못했습니다.');
      }
    },
    [category, verifiedOnly, showToast]
  );

  // 위치나 필터 변경 시 자동 갱신
  useEffect(() => {
    if (coords.lat && coords.lon) {
      loadFacilities(coords.lat, coords.lon, category, verifiedOnly);
    }
  }, [coords.lat, coords.lon, category, verifiedOnly, loadFacilities]);

  // 카테고리 필터 변경 핸들러
  const handleSelectCategory = (cat) => {
    setCategory(cat);
  };

  const handleToggleVerified = () => {
    setVerifiedOnly((prev) => !prev);
  };

  // 장소 및 주소 검색 핸들러 (Kakao Places + Geocoder)
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

  // 도보 실시간 내비게이션 시작
  const handleStartNavigation = async (targetFacility) => {
    if (!targetFacility) return;
    setNavTarget(targetFacility);
    setIsNavigating(true);
    setIsSheetCollapsed(true);
    showToast(`🚶 '${targetFacility.name}' 도보 길안내를 시작합니다.`);

    const res = await fetchPedestrianDirections(
      { lat: coords.lat, lon: coords.lon },
      { lat: targetFacility.lat, lon: targetFacility.lon }
    );

    if (res.success) {
      setNavData(res);
    } else {
      showToast('상세 보행로 탐색 실패: 직선 경로로 대체 안내합니다.');
      setNavData({
        coordinates: [
          [coords.lon, coords.lat],
          [targetFacility.lon, targetFacility.lat],
        ],
        totalDistanceMeters: targetFacility.distanceMeters,
        totalDurationSeconds: Math.round(targetFacility.distanceMeters / 1.25),
        durationMinutes: Math.max(1, Math.round(targetFacility.distanceMeters / 75)),
        steps: [
          {
            instruction: `${targetFacility.name}를 향해 직선 도로망으로 이동하세요.`,
            distanceMeters: targetFacility.distanceMeters,
            type: 'arrive',
          },
        ],
      });
    }
  };

  const handleCloseNavigation = () => {
    setIsNavigating(false);
    setNavTarget(null);
    setNavData(null);
    setIsSheetCollapsed(false);
  };

  // 제보 제출 핸들러
  const handleSubmitReport = async (reportData) => {
    const res = await submitReport(reportData);
    if (res.success) {
      showToast('✅ 제보가 접수되었습니다. 긴급 안전망 검증에 즉시 반영됩니다.');
      loadFacilities(coords.lat, coords.lon);
    } else {
      showToast(res.message || '제보 접수에 실패했습니다.');
    }
  };

  const counts = {
    total: facilities.length,
    aed: facilities.filter((f) => f.category === 'aed').length,
    extinguisher: facilities.filter((f) => f.category === 'extinguisher').length,
    hydrant: facilities.filter((f) => f.category === 'hydrant').length,
  };

  return (
    <div id="app" className="app-container">
      {/* 1. 메인 지도 래퍼 (지도 + 상단 플로팅 바 + 내비게이션 패널) */}
      <main className="map-wrapper">
        {isKakaoLoaded ? (
          <KakaoMap
            isLoaded={isKakaoLoaded}
            userCoords={coords}
            facilities={facilities}
            selectedFacility={selectedFacility}
            onSelectFacility={(fac) => {
              setSelectedFacility(fac);
              setIsSheetCollapsed(false);
            }}
            onOpenCluster={(cluster) => setClusterModalData(cluster)}
            navRouteCoordinates={navData?.coordinates || null}
            onReSearch={(newLat, newLon) => {
              setManualCoords(newLat, newLon);
              showToast('현재 화면 중심으로 안전시설을 다시 검색합니다.');
            }}
            onToggleSheet={() => setIsSheetCollapsed((prev) => !prev)}
            onToast={showToast}
          />
        ) : (
          <div className="map-view" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 24, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 16 }}>🗺️</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>카카오맵 활성화 중...</h3>
            <p style={{ fontSize: 14, color: '#64748b', maxWidth: 360 }}>
              {kakaoError || '서버 환경변수(KAKAO_MAP_API_KEY) 확인 및 지도 초기화를 진행하고 있습니다.'}
            </p>
          </div>
        )}

        {/* 상단 플로팅 헤더, 검색창, 필터 칩 */}
        <Header
          category={category}
          onSelectCategory={handleSelectCategory}
          verifiedOnly={verifiedOnly}
          onToggleVerified={handleToggleVerified}
          counts={counts}
          onSearch={handleSearch}
          onResetGps={() => {
            requestGps();
            showToast('실제 GPS 위치로 지도를 재설정합니다.');
          }}
          onOpenStats={() => setShowStatsModal(true)}
          onOpenSystemInfo={() => setShowSystemInfoModal(true)}
          isSearching={isSearching}
        />

        {/* 실시간 도보 내비게이션 플로팅 패널 */}
        {isNavigating && navTarget && (
          <InAppNavigation
            navData={navData}
            destination={navTarget}
            onClose={handleCloseNavigation}
            onFollowGps={() => {
              requestGps();
              showToast('내 위치 추적을 활성화했습니다.');
            }}
            onFitRoute={() => {
              if (navData?.coordinates) {
                showToast('전체 경로 영역으로 지도를 맞췄습니다.');
              }
            }}
          />
        )}
      </main>

      {/* 2. 하단 안전시설 바텀시트 */}
      <BottomSheet
        facilities={facilities}
        selectedFacility={selectedFacility}
        onSelectFacility={(fac) => setSelectedFacility(fac)}
        isCollapsed={isSheetCollapsed}
        onToggleCollapse={() => setIsSheetCollapsed((prev) => !prev)}
        onStartNavigation={handleStartNavigation}
        onOpenReport={(fac) => setReportModalData(fac)}
      />

      {/* 3. 모달 창들 */}
      {clusterModalData && (
        <ClusterModal
          cluster={clusterModalData}
          selectedFacilityId={selectedFacility?.id}
          onClose={() => setClusterModalData(null)}
          onSelectFacility={(fac) => {
            setSelectedFacility(fac);
            setIsSheetCollapsed(false);
          }}
        />
      )}

      {reportModalData && (
        <ReportModal
          facility={reportModalData}
          onClose={() => setReportModalData(null)}
          onSubmitReport={handleSubmitReport}
        />
      )}

      {showStatsModal && (
        <StatsModal
          stats={stats}
          onClose={() => setShowStatsModal(false)}
        />
      )}

      {showSystemInfoModal && (
        <SystemInfoModal
          config={config}
          onClose={() => setShowSystemInfoModal(false)}
        />
      )}

      {/* 4. 토스트 알림 */}
      <Toast
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
}
