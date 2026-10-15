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
  submitCheckin,
} from './services/api';

const CACHE_KEY = 'safemap_cached_facilities_v1';

export default function App() {
  const [config, setConfig] = useState(null);
  const [category, setCategory] = useState('all');
  const [verifiedOnly, setVerifiedOnly] = useState(true);

  const [facilities, setFacilities] = useState([]);
  const [stats, setStats] = useState(null);
  const [backup24h, setBackup24h] = useState(null);
  const [selectedFacility, setSelectedFacility] = useState(null);

  // 내비게이션 상태
  const [isNavigating, setIsNavigating] = useState(false);
  const [navTarget, setNavTarget] = useState(null);
  const [navData, setNavData] = useState(null);

  // 3단 스냅 바텀시트 상태 ('minimized' | 'peek' | 'expanded')
  const [sheetSnap, setSheetSnap] = useState('peek');

  // Emergency Zen Mode (길안내 또는 지도 드래그 시 상단바/FAB 숨김)
  const [isZenMode, setIsZenMode] = useState(false);

  // 모달 및 토스트 상태
  const [clusterModalData, setClusterModalData] = useState(null);
  const [reportModalData, setReportModalData] = useState(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showSystemInfoModal, setShowSystemInfoModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
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

  // [Task 4: Stale-While-Revalidate] 앱 기동 시 0.1초 내 로컬 캐시 즉시 렌더링
  useEffect(() => {
    try {
      const cachedStr = localStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (cached?.facilities?.length > 0) {
          setFacilities(cached.facilities);
          setSelectedFacility(cached.facilities[0]);
          if (cached.stats) setStats(cached.stats);
          if (cached.backup24h) setBackup24h(cached.backup24h);
        }
      }
    } catch (err) {
      console.warn('Cache parsing failed:', err);
    }
  }, []);

  // 4. [Task 4: 2-Phase 연산] 시설 데이터 로드 (Phase 1 즉시 렌더 ➔ Phase 2 상위 3개 비동기 OSRM 보정)
  const loadFacilities = useCallback(
    async (lat, lon, cat = category, verified = verifiedOnly) => {
      const res = await fetchFacilities(lat, lon, cat, verified);
      if (res.success && res.facilities) {
        const loadedList = res.facilities;
        setStats(res.stats || null);
        setBackup24h(res.backup24h || null);

        // Phase 1: Haversine 거리 기준 정렬 목록 즉시 렌더 (FCP 및 체감속도 0.1초 미만)
        if (loadedList.length > 0) {
          setSelectedFacility(loadedList[0]);
        }
        setFacilities(loadedList);

        // 캐시 업데이트 (Stale-While-Revalidate)
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              facilities: loadedList,
              stats: res.stats,
              backup24h: res.backup24h,
              coords: { lat, lon },
              timestamp: Date.now(),
            })
          );
        } catch (e) {
          console.warn('Failed to cache facilities:', e);
        }

        // Phase 2: 상위 3개 핵심 시설만 비동기 OSRM 정밀 보행 도로망 매트릭스 보정
        if (loadedList.length > 0) {
          const topCandidates = loadedList.slice(0, 3).map((f) => ({
            id: f.id,
            lat: f.lat,
            lon: f.lon,
          }));

          fetchRouteMatrix({ lat, lon }, topCandidates).then((matrixRes) => {
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

              setSelectedFacility((prev) => {
                if (!prev) return prev;
                const m = resMap.get(prev.id);
                return m
                  ? {
                      ...prev,
                      realDistanceMeters: m.distanceMeters,
                      realDurationSeconds: m.durationSeconds,
                      realDurationText: m.walkingTimeText,
                      isRealRoad: m.isRealRoad,
                    }
                  : prev;
              });
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
        setSheetSnap('peek');
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
            setSheetSnap('peek');
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
    setSheetSnap('minimized');
    setIsZenMode(true); // Emergency Zen Mode 활성화
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
            instruction: `${targetFacility.name}를 향해 도로망을 따라 이동하세요.`,
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
    setSheetSnap('peek');
    setIsZenMode(false);
  };

  // [Task 3: Micro Check-in 원터치 상태 확인 핸들러]
  const handleCheckin = async (facilityId, status, note = '') => {
    const res = await submitCheckin(facilityId, status, note);
    if (res.success) {
      showToast(
        status === 'NORMAL'
          ? '👍 [정상 비치 확인]이 등록되었습니다. 실시간 안전망에 반영됩니다!'
          : '⚠️ [잠김·고장 신고]가 등록되었습니다. 긴급 대체 경로를 권장합니다.'
      );

      // 낙관적 UI 업데이트
      const updateCheckin = (fac) => {
        if (!fac || fac.id !== facilityId) return fac;
        const cur = fac.checkin || { normalCount: 0, issueCount: 0 };
        return {
          ...fac,
          checkin: {
            ...cur,
            normalCount: status === 'NORMAL' ? (cur.normalCount || 0) + 1 : cur.normalCount,
            issueCount: status === 'ISSUE' ? (cur.issueCount || 0) + 1 : cur.issueCount,
            lastStatus: status,
          },
        };
      };

      setFacilities((prev) => prev.map(updateCheckin));
      setSelectedFacility((prev) => updateCheckin(prev));
    } else {
      showToast(res.message || '상태 확인 접수에 실패했습니다.');
    }
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
    shelter: facilities.filter((f) => f.category === 'shelter').length,
  };

  const handleUserLocationChange = useCallback((newLat, newLon) => {
    setManualCoords(newLat, newLon);
  }, [setManualCoords]);

  const handleSelectFacility = useCallback((fac) => {
    setSelectedFacility(fac);
    setSheetSnap('peek');
  }, []);

  const handleOpenCluster = useCallback((cluster) => {
    setClusterModalData(cluster);
  }, []);

  const handleToggleSheet = useCallback(() => {
    setSheetSnap((prev) => (prev === 'minimized' ? 'peek' : 'minimized'));
  }, []);

  const handleReSearch = useCallback((newLat, newLon) => {
    setManualCoords(newLat, newLon);
    showToast('현재 화면 중심으로 안전시설을 다시 검색합니다.');
  }, [setManualCoords, showToast]);

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
            onSelectFacility={handleSelectFacility}
            onOpenCluster={handleOpenCluster}
            navRouteCoordinates={navData?.coordinates || null}
            onReSearch={handleReSearch}
            onToggleSheet={handleToggleSheet}
            onToast={showToast}
            onUserLocationChange={handleUserLocationChange}
            onRequestGps={() => requestGps(true)}
            isZenMode={isZenMode}
            onZenModeChange={setIsZenMode}
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

        {/* 상단 단일 슬림 플로팅 헤더, 검색창, 필터 칩 */}
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
          isZenMode={isZenMode}
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

      {/* 2. 하단 3단 스냅 바텀시트 - 길안내 중에는 숨겨서 내비 패널과의 중복 충돌 방지 */}
      {!isNavigating && (
        <BottomSheet
          facilities={facilities}
          selectedFacility={selectedFacility}
          onSelectFacility={handleSelectFacility}
          snapState={sheetSnap}
          onSnapChange={setSheetSnap}
          onStartNavigation={handleStartNavigation}
          onOpenReport={(fac) => setReportModalData(fac)}
          onCheckin={handleCheckin}
          backup24h={backup24h}
        />
      )}

      {/* 3. 모달 창들 */}
      {clusterModalData && (
        <ClusterModal
          cluster={clusterModalData}
          selectedFacilityId={selectedFacility?.id}
          onClose={() => setClusterModalData(null)}
          onSelectFacility={(fac) => {
            setSelectedFacility(fac);
            setSheetSnap('peek');
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
