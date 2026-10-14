import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createCustomPinIcon,
  createClusterPinIcon,
  createUserLocationIcon,
  createFloatingPillContent,
  createInfoWindowContent,
  calculateDistanceMeters,
  calculateSpiderPositions,
} from '../utils/mapIcons';

export default function KakaoMap({
  isLoaded,
  userCoords,
  facilities,
  selectedFacility,
  onSelectFacility,
  onOpenCluster,
  navRouteCoordinates,
  onReSearch,
  onToggleSheet,
  onToast,
  onUserLocationChange,
  onRequestGps,
  isZenMode,
  onZenModeChange,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const floatingPillOverlayRef = useRef(null);
  const routePolylineRef = useRef(null);
  const indoorDashLineRef = useRef(null);

  // 마커 터치 시 맵 클릭 이벤트 전파로 인한 스파이더 즉시 닫힘 방지 플래그
  const justClickedMarkerRef = useRef(false);

  // 스파이더파이어 상태 관리
  const spiderDataRef = useRef({
    activeCluster: null,
    clusterMarker: null,
    centerOverlay: null,
    lines: [],
    markers: [],
  });

  const [isSkyview, setIsSkyview] = useState(false);

  // 콜백 레퍼런스 안정화 (마커 재렌더링 방지)
  const onSelectFacilityRef = useRef(onSelectFacility);
  useEffect(() => {
    onSelectFacilityRef.current = onSelectFacility;
  }, [onSelectFacility]);

  // 스파이더 접기 함수
  const collapseSpider = useCallback(() => {
    const s = spiderDataRef.current;
    if (s.clusterMarker) {
      s.clusterMarker.setVisible(true);
      s.clusterMarker = null;
    }
    if (s.centerOverlay) {
      s.centerOverlay.setMap(null);
      s.centerOverlay = null;
    }
    s.lines.forEach((l) => l.setMap(null));
    s.lines = [];
    s.markers.forEach((m) => {
      if (m.marker) m.marker.setMap(null);
      if (m.infoWindow) m.infoWindow.close();
    });
    s.markers = [];
    s.activeCluster = null;
  }, []);

  // 바텀시트 높이를 고려한 지도 중심 오프셋 이동 함수
  const panToWithOffset = useCallback((latlng, offsetY = 70) => {
    const map = mapRef.current;
    if (!map) return;
    map.panTo(latlng);
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.panBy(0, offsetY);
      }
    }, 50);
  }, []);

  // 1. 지도 인스턴스 초기화 (터치 드래그 활성화 및 이벤트 최적화)
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapRef.current) return;

    const initialPos = new window.kakao.maps.LatLng(userCoords.lat, userCoords.lon);
    const options = {
      center: initialPos,
      level: 3,
      draggable: true,
      scrollwheel: true,
      disableDoubleClick: false,
    };

    const map = new window.kakao.maps.Map(mapContainerRef.current, options);
    mapRef.current = map;

    // 모바일 터치 및 드래그 명시적 활성화
    map.setDraggable(true);
    map.setZoomable(true);

    // 지도 클릭: 빈 공간 클릭 시에만 팝업/스파이더 닫기 & 젠 모드 해제
    window.kakao.maps.event.addListener(map, 'click', () => {
      if (justClickedMarkerRef.current) return;
      collapseSpider();
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
      // 직접 DOM 클래스 제어로 부드럽게 복구
      const topBar = document.querySelector('.top-floating-bar');
      if (topBar) topBar.classList.remove('zen-hidden');
      const fabGroup = document.querySelector('.map-fab-group');
      if (fabGroup) fabGroup.classList.remove('zen-hidden');
      if (onZenModeChange) onZenModeChange(false);
    });

    // 지도 드래그 시작 시: Emergency Zen Mode 활성화 (리액트 리렌더 없이 GPU 가속 직접 적용)
    window.kakao.maps.event.addListener(map, 'dragstart', () => {
      const topBar = document.querySelector('.top-floating-bar');
      if (topBar) topBar.classList.add('zen-hidden');
      const fabGroup = document.querySelector('.map-fab-group');
      if (fabGroup) fabGroup.classList.add('zen-hidden');
    });

    // 지도 우클릭: 해당 지점을 내 위치로 즉시 지정
    window.kakao.maps.event.addListener(map, 'rightclick', (mouseEvent) => {
      const latlng = mouseEvent.latLng;
      const clickedLat = latlng.getLat();
      const clickedLon = latlng.getLng();
      if (onUserLocationChange) {
        onUserLocationChange(clickedLat, clickedLon);
      }
      if (onToast) {
        onToast('📍 지도에서 우클릭한 위치를 내 위치로 설정했습니다.');
      }
    });
  }, [isLoaded, collapseSpider, onUserLocationChange, onToast, onZenModeChange]);

  // 2. 사용자 현위치 마커 갱신 (지도가 사용자의 드래그를 방해하지 않도록 초기화 시에만 panTo)
  const isInitialLocationSetRef = useRef(false);
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    const map = mapRef.current;
    const pos = new window.kakao.maps.LatLng(userCoords.lat, userCoords.lon);

    if (!userMarkerRef.current) {
      const marker = new window.kakao.maps.Marker({
        position: pos,
        map: map,
        title: '내 현재 위치',
        zIndex: 999,
        draggable: false, // 모바일/태블릿 터치 제스처 간섭 원천 차단
        image: createUserLocationIcon(),
      });

      userMarkerRef.current = marker;
      panToWithOffset(pos, 60);
      isInitialLocationSetRef.current = true;
    } else {
      userMarkerRef.current.setPosition(pos);
      // 위치가 수동 지정 또는 GPS 갱신으로 크게 바뀐 경우에만 이동
      if (!isInitialLocationSetRef.current) {
        panToWithOffset(pos, 60);
        isInitialLocationSetRef.current = true;
      }
    }
  }, [userCoords.lat, userCoords.lon, panToWithOffset]);

  // 선택된 시설 변경 시 고시인성 현장 힌트 말풍선(Floating Pill) 오버레이 갱신
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.kakao?.maps) return;

    if (floatingPillOverlayRef.current) {
      floatingPillOverlayRef.current.setMap(null);
      floatingPillOverlayRef.current = null;
    }

    if (selectedFacility && !isNaN(selectedFacility.lat) && !isNaN(selectedFacility.lon)) {
      const pos = new window.kakao.maps.LatLng(selectedFacility.lat, selectedFacility.lon);
      const overlay = new window.kakao.maps.CustomOverlay({
        position: pos,
        map: map,
        content: createFloatingPillContent(selectedFacility),
        yAnchor: 2.15,
        xAnchor: 0.5,
        zIndex: 700,
        clickable: false, // 터치 이벤트 관통 허용
      });
      floatingPillOverlayRef.current = overlay;
    }
  }, [selectedFacility]);

  // 3. 시설 마커 클러스터링 및 렌더링 (동일 건물 및 근접 장비 묶음 보장)
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    const map = mapRef.current;
    collapseSpider();

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    const clusters = [];
    facilities.forEach((item) => {
      let matchedCluster = null;
      for (const cl of clusters) {
        const d = calculateDistanceMeters(cl[0].lat, cl[0].lon, item.lat, item.lon);
        // 동일 주소이거나 22m 이내의 시설들을 클러스터링
        const sameAddress = Boolean(
          cl[0].buildAddress &&
          item.buildAddress &&
          cl[0].buildAddress.length > 5 &&
          cl[0].buildAddress === item.buildAddress
        );
        if (d <= 22 || sameAddress) {
          matchedCluster = cl;
          break;
        }
      }
      if (matchedCluster) {
        matchedCluster.push(item);
      } else {
        clusters.push([item]);
      }
    });

    clusters.forEach((cluster) => {
      const centerItem = cluster[0];
      const centerPos = new window.kakao.maps.LatLng(centerItem.lat, centerItem.lon);
      const isNearest = cluster.some((f) => f.isNearest);
      const containsSelected = cluster.some((f) => f.id === selectedFacility?.id);

      if (cluster.length === 1) {
        const marker = new window.kakao.maps.Marker({
          position: centerPos,
          map: map,
          title: `[${centerItem.categoryName}] ${centerItem.name}`,
          zIndex: containsSelected ? 500 : (isNearest ? 400 : 300),
          image: createCustomPinIcon(centerItem, isNearest, containsSelected),
        });

        const iw = new window.kakao.maps.InfoWindow({
          content: createInfoWindowContent(centerItem, isNearest),
          removable: true,
        });

        window.kakao.maps.event.addListener(marker, 'click', () => {
          justClickedMarkerRef.current = true;
          setTimeout(() => { justClickedMarkerRef.current = false; }, 400);

          collapseSpider();
          if (infoWindowRef.current) infoWindowRef.current.close();
          iw.open(map, marker);
          infoWindowRef.current = iw;
          panToWithOffset(centerPos, 80);
          if (onSelectFacilityRef.current) onSelectFacilityRef.current(centerItem);
        });

        if (containsSelected) {
          iw.open(map, marker);
          infoWindowRef.current = iw;
        }

        markersRef.current.push(marker);
      } else {
        // 복수 장비 밀집 클러스터 핀 생성
        const clusterMarker = new window.kakao.maps.Marker({
          position: centerPos,
          map: map,
          title: `${centerItem.buildAddress || centerItem.org} (${cluster.length}대 밀집)`,
          zIndex: containsSelected ? 550 : 350,
          image: createClusterPinIcon(cluster, isNearest),
        });

        window.kakao.maps.event.addListener(clusterMarker, 'click', () => {
          justClickedMarkerRef.current = true;
          setTimeout(() => { justClickedMarkerRef.current = false; }, 400);

          expandSpider(cluster, clusterMarker, centerItem);
        });

        markersRef.current.push(clusterMarker);
      }
    });
  }, [facilities, selectedFacility?.id, collapseSpider, panToWithOffset]);

  // 스파이더파이어 방사형 펼침 기능
  const expandSpider = (cluster, clusterMarker, centerItem) => {
    const map = mapRef.current;
    if (!map) return;

    collapseSpider();

    spiderDataRef.current.activeCluster = cluster;
    spiderDataRef.current.clusterMarker = clusterMarker;
    clusterMarker.setVisible(false);

    const centerPos = { lat: centerItem.lat, lng: centerItem.lon };

    const centerOverlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(centerPos.lat, centerPos.lng),
      map: map,
      zIndex: 200,
      clickable: false,
      content: '<div style="width: 14px; height: 14px; background: #3b82f6; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px rgba(0,0,0,0.4);"></div>',
    });
    spiderDataRef.current.centerOverlay = centerOverlay;

    const spiderPositions = calculateSpiderPositions(cluster, centerPos);

    spiderPositions.forEach(({ item, spiderPos }) => {
      const line = new window.kakao.maps.Polyline({
        path: [
          new window.kakao.maps.LatLng(centerPos.lat, centerPos.lng),
          new window.kakao.maps.LatLng(spiderPos.lat, spiderPos.lng),
        ],
        strokeColor: '#3b82f6',
        strokeOpacity: 0.85,
        strokeWeight: 2.5,
        map: map,
      });
      spiderDataRef.current.lines.push(line);

      const isSelected = selectedFacility?.id === item.id;
      const spiderPin = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(spiderPos.lat, spiderPos.lng),
        map: map,
        title: `[${item.categoryName}] ${item.name}`,
        zIndex: isSelected ? 600 : 500,
        image: createCustomPinIcon(item, item.isNearest, isSelected),
      });

      const iw = new window.kakao.maps.InfoWindow({
        content: createInfoWindowContent(item, item.isNearest),
        removable: true,
      });

      window.kakao.maps.event.addListener(spiderPin, 'click', () => {
        justClickedMarkerRef.current = true;
        setTimeout(() => { justClickedMarkerRef.current = false; }, 400);

        if (infoWindowRef.current) infoWindowRef.current.close();
        iw.open(map, spiderPin);
        infoWindowRef.current = iw;
        panToWithOffset(new window.kakao.maps.LatLng(spiderPos.lat, spiderPos.lng), 80);
        if (onSelectFacilityRef.current) onSelectFacilityRef.current(item);
      });

      spiderDataRef.current.markers.push({ marker: spiderPin, infoWindow: iw, item });
    });

    if (onOpenCluster) onOpenCluster(cluster);
    if (onToast) onToast(`🏢 밀집 시설 ${cluster.length}대가 방사형으로 펼쳐졌습니다.`);
  };

  // 4. 도보 내비게이션 경로선 (Polyline) 및 실내 진입 점선 렌더링 (다양한 좌표 형식 안전 파싱)
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    const map = mapRef.current;

    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
    if (indoorDashLineRef.current) {
      indoorDashLineRef.current.setMap(null);
      indoorDashLineRef.current = null;
    }

    if (navRouteCoordinates && navRouteCoordinates.length > 0) {
      const path = navRouteCoordinates.map((c) => {
        if (Array.isArray(c) && c.length >= 2) {
          const lat = parseFloat(c[1]);
          const lon = parseFloat(c[0]);
          if (!isNaN(lat) && !isNaN(lon)) return new window.kakao.maps.LatLng(lat, lon);
        } else if (c && typeof c === 'object') {
          const lat = parseFloat(c.lat);
          const lon = parseFloat(c.lng || c.lon);
          if (!isNaN(lat) && !isNaN(lon)) return new window.kakao.maps.LatLng(lat, lon);
        }
        return null;
      }).filter(Boolean);

      if (path.length >= 2) {
        const polyline = new window.kakao.maps.Polyline({
          path: path,
          strokeWeight: 6,
          strokeColor: '#2563eb',
          strokeOpacity: 0.95,
          strokeStyle: 'solid',
          map: map,
        });
        routePolylineRef.current = polyline;

        // 실외 도로망 종점부터 건물 내부 목적지까지 실내 진입 점선(Dashed) 연결
        if (selectedFacility && !isNaN(selectedFacility.lat) && !isNaN(selectedFacility.lon)) {
          const lastRoadPt = path[path.length - 1];
          const targetPt = new window.kakao.maps.LatLng(selectedFacility.lat, selectedFacility.lon);
          const dashLine = new window.kakao.maps.Polyline({
            path: [lastRoadPt, targetPt],
            strokeWeight: 4,
            strokeColor: '#f97316',
            strokeOpacity: 0.9,
            strokeStyle: 'shortdash',
            map: map,
          });
          indoorDashLineRef.current = dashLine;
        }

        const bounds = new window.kakao.maps.LatLngBounds();
        path.forEach((pt) => bounds.extend(pt));
        if (selectedFacility && !isNaN(selectedFacility.lat) && !isNaN(selectedFacility.lon)) {
          bounds.extend(new window.kakao.maps.LatLng(selectedFacility.lat, selectedFacility.lon));
        }
        map.setBounds(bounds);
      }

      // 지도 레이아웃 리프레시 (타일 깨짐 원천 방지)
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.relayout();
          mapRef.current.panBy(0, 50);
        }
      }, 100);
    }
  }, [navRouteCoordinates, selectedFacility]);

  // 5. 모바일/태블릿 터치 제스처 완벽 보장 엔진 (터치 드래그 패닝 & 핀치 줌 & 더블탭 줌)
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || !mapRef.current) return;

    const map = mapRef.current;
    let isTouching = false;
    let isPinching = false;
    let lastX = 0;
    let lastY = 0;
    let initialPinchDist = 0;
    let lastTapTime = 0;
    let nativeDragActive = false;

    // 카카오맵 자체 드래그 리스너 (브라우저가 네이티브로 드래그를 처리하는 경우 감지)
    const onNativeDrag = () => {
      nativeDragActive = true;
    };
    window.kakao.maps.event.addListener(map, 'dragstart', onNativeDrag);
    window.kakao.maps.event.addListener(map, 'drag', onNativeDrag);

    const handleTouchStart = (e) => {
      if (e.target && e.target.closest && (
        e.target.closest('button') ||
        e.target.closest('.bottom-sheet') ||
        e.target.closest('.top-floating-bar') ||
        e.target.closest('.map-fab-group') ||
        e.target.closest('.cluster-popup-modal') ||
        e.target.closest('.modal-overlay')
      )) {
        return;
      }

      nativeDragActive = false;

      if (e.touches.length === 1) {
        isTouching = true;
        isPinching = false;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;

        // 더블 탭 확대 감지 (320ms 이내 2회 탭)
        const now = Date.now();
        if (now - lastTapTime < 320) {
          const cur = map.getLevel();
          if (cur > 1) {
            map.setLevel(cur - 1, { animate: true });
          }
          lastTapTime = 0;
        } else {
          lastTapTime = now;
        }
      } else if (e.touches.length === 2) {
        isTouching = false;
        isPinching = true;
        const x1 = e.touches[0].clientX;
        const y1 = e.touches[0].clientY;
        const x2 = e.touches[1].clientX;
        const y2 = e.touches[1].clientY;
        initialPinchDist = Math.hypot(x1 - x2, y1 - y2);
      }
    };

    const handleTouchMove = (e) => {
      if (isPinching && e.touches.length === 2) {
        if (e.cancelable) e.preventDefault();
        const x1 = e.touches[0].clientX;
        const y1 = e.touches[0].clientY;
        const x2 = e.touches[1].clientX;
        const y2 = e.touches[1].clientY;
        const currentDist = Math.hypot(x1 - x2, y1 - y2);
        const diff = currentDist - initialPinchDist;

        if (diff > 35) {
          const cur = map.getLevel();
          if (cur > 1) {
            map.setLevel(cur - 1, { animate: true });
          }
          initialPinchDist = currentDist;
        } else if (diff < -35) {
          const cur = map.getLevel();
          if (cur < 14) {
            map.setLevel(cur + 1, { animate: true });
          }
          initialPinchDist = currentDist;
        }
        return;
      }

      if (isTouching && e.touches.length === 1) {
        const curX = e.touches[0].clientX;
        const curY = e.touches[0].clientY;
        const dx = curX - lastX;
        const dy = curY - lastY;

        if (e.cancelable) e.preventDefault();

        // 카카오맵 자체 드래그가 미동작하는 환경(태블릿/모바일 데스크톱 모드 등)에서 100% 매끄러운 panBy 보정
        if (!nativeDragActive && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
          map.panBy(-dx, -dy);
        }

        lastX = curX;
        lastY = curY;
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length === 0) {
        isTouching = false;
        isPinching = false;
        nativeDragActive = false;
      } else if (e.touches.length === 1) {
        isPinching = false;
        isTouching = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.kakao.maps.event.removeListener(map, 'dragstart', onNativeDrag);
      window.kakao.maps.event.removeListener(map, 'drag', onNativeDrag);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isLoaded]);

  // FAB 버튼 핸들러들
  const handleSnapUserGps = () => {
    if (!mapRef.current) return;
    if (onRequestGps) {
      onRequestGps();
    }
    const pos = new window.kakao.maps.LatLng(userCoords.lat, userCoords.lon);
    panToWithOffset(pos, 60);
    mapRef.current.setLevel(3);
    if (onToast) onToast('📍 내 위치로 지도를 이동하고 GPS를 갱신했습니다.');
  };

  const handleZoomIn = () => {
    if (!mapRef.current) return;
    const cur = mapRef.current.getLevel();
    if (cur > 1) {
      mapRef.current.setLevel(cur - 1, { animate: true });
      if (onToast) onToast(`지도 확대 (레벨 ${cur - 1})`);
    }
  };

  const handleZoomOut = () => {
    if (!mapRef.current) return;
    const cur = mapRef.current.getLevel();
    if (cur < 14) {
      mapRef.current.setLevel(cur + 1, { animate: true });
      if (onToast) onToast(`지도 축소 (레벨 ${cur + 1})`);
    }
  };

  const handleReSearchArea = () => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    if (onReSearch) onReSearch(center.getLat(), center.getLng());
  };

  const handleToggleMapLayer = () => {
    if (!mapRef.current) return;
    const nextSkyview = !isSkyview;
    setIsSkyview(nextSkyview);
    if (nextSkyview) {
      mapRef.current.setMapTypeId(window.kakao.maps.MapTypeId.HYBRID);
      if (onToast) onToast('스카이뷰(위성사진)로 전환했습니다.');
    } else {
      mapRef.current.setMapTypeId(window.kakao.maps.MapTypeId.ROADMAP);
      if (onToast) onToast('일반 지도로 전환했습니다.');
    }
  };

  return (
    <>
      <div id="mainMap" ref={mapContainerRef} className="map-view" />

      {/* 우측 상단 플로팅 툴바 (FAB) - Zen Mode 시 부드럽게 페이드 아웃 */}
      <div className={`map-fab-group ${isZenMode ? 'zen-hidden' : ''}`}>
        <button
          type="button"
          className="fab-btn primary"
          title="내 위치로 이동"
          onClick={handleSnapUserGps}
        >
          <span>📍</span>
        </button>

        <button
          type="button"
          className="fab-btn zoom-btn"
          title="지도 확대 (+)"
          onClick={handleZoomIn}
        >
          <span>➕</span>
        </button>

        <button
          type="button"
          className="fab-btn zoom-btn"
          title="지도 축소 (-)"
          onClick={handleZoomOut}
        >
          <span>➖</span>
        </button>

        <button
          type="button"
          className="fab-btn"
          title="현 화면 기준 재검색"
          onClick={handleReSearchArea}
        >
          <span>🔄</span>
        </button>

        <button
          type="button"
          className="fab-btn"
          title="위성 / 일반 지도 전환"
          onClick={handleToggleMapLayer}
        >
          <span>{isSkyview ? '🗺️' : '🛰️'}</span>
        </button>

        <button
          type="button"
          className="fab-btn sheet-toggle"
          title="정보 카드 접기 / 펼치기"
          onClick={onToggleSheet}
        >
          <span>🔽</span>
        </button>
      </div>
    </>
  );
}
