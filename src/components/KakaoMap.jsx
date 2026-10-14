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

  // 스파이더파이어 상태 관리
  const spiderDataRef = useRef({
    activeCluster: null,
    clusterMarker: null,
    centerOverlay: null,
    lines: [],
    markers: [],
  });

  const [isSkyview, setIsSkyview] = useState(false);

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

  // 바텀시트 높이(약 140~180px)를 고려한 지도 중심 오프셋 이동 함수
  const panToWithOffset = useCallback((latlng, offsetY = 80) => {
    const map = mapRef.current;
    if (!map) return;
    map.panTo(latlng);
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.panBy(0, offsetY);
      }
    }, 40);
  }, []);

  // 1. 지도 인스턴스 초기화
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapRef.current) return;

    const initialPos = new window.kakao.maps.LatLng(userCoords.lat, userCoords.lon);
    const options = {
      center: initialPos,
      level: 3,
    };

    const map = new window.kakao.maps.Map(mapContainerRef.current, options);
    mapRef.current = map;

    // 지도 좌클릭: 팝업 및 스파이더 닫기 & 젠 모드 해제
    window.kakao.maps.event.addListener(map, 'click', () => {
      collapseSpider();
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
      if (onZenModeChange) onZenModeChange(false);
    });

    // 지도 드래그 시작 시: Emergency Zen Mode 활성화 (시야 85% 확보)
    window.kakao.maps.event.addListener(map, 'dragstart', () => {
      if (onZenModeChange) onZenModeChange(true);
    });

    // 지도 우클릭: 해당 지점을 내 위치로 즉시 지정 (PC 오차 보정 편의 기능)
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

  // 2. 사용자 현위치 마커 갱신 및 지도 중심 이동 (panToWithOffset)
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    const map = mapRef.current;
    const pos = new window.kakao.maps.LatLng(userCoords.lat, userCoords.lon);

    if (!userMarkerRef.current) {
      const marker = new window.kakao.maps.Marker({
        position: pos,
        map: map,
        title: '내 현재 위치 (마우스로 드래그하여 정확한 위치로 이동 가능)',
        zIndex: 999,
        draggable: true,
        image: createUserLocationIcon(),
      });

      window.kakao.maps.event.addListener(marker, 'dragend', () => {
        const newPos = marker.getPosition();
        const lat = newPos.getLat();
        const lon = newPos.getLng();
        if (onUserLocationChange) {
          onUserLocationChange(lat, lon);
        }
        if (onToast) {
          onToast('📍 내 위치 핀을 이동했습니다. 주변 안전시설을 갱신합니다.');
        }
      });

      userMarkerRef.current = marker;
    } else {
      userMarkerRef.current.setPosition(pos);
    }

    panToWithOffset(pos, 60);
  }, [userCoords.lat, userCoords.lon, onUserLocationChange, onToast, panToWithOffset]);

  // 선택된 시설 변경 시 고시인성 현장 힌트 말풍선(Floating Pill) 오버레이 갱신
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.kakao?.maps) return;

    if (floatingPillOverlayRef.current) {
      floatingPillOverlayRef.current.setMap(null);
      floatingPillOverlayRef.current = null;
    }

    if (selectedFacility) {
      const pos = new window.kakao.maps.LatLng(selectedFacility.lat, selectedFacility.lon);
      const overlay = new window.kakao.maps.CustomOverlay({
        position: pos,
        map: map,
        content: createFloatingPillContent(selectedFacility),
        yAnchor: 2.15,
        xAnchor: 0.5,
        zIndex: 700,
      });
      floatingPillOverlayRef.current = overlay;
    }
  }, [selectedFacility]);

  // 3. 시설 마커 클러스터링 및 렌더링
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
        // 클러스터링 임계값을 26m에서 12m로 대폭 축소하여 서로 다른 건물의 장비가 묶이지 않도록 개선
        if (d <= 12) {
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
          collapseSpider();
          if (infoWindowRef.current) infoWindowRef.current.close();
          iw.open(map, marker);
          infoWindowRef.current = iw;
          panToWithOffset(centerPos, 90);
          onSelectFacility(centerItem);
        });

        if (containsSelected) {
          iw.open(map, marker);
          infoWindowRef.current = iw;
        }

        markersRef.current.push(marker);
      } else {
        const clusterMarker = new window.kakao.maps.Marker({
          position: centerPos,
          map: map,
          title: `${centerItem.buildAddress || centerItem.org} (${cluster.length}대 밀집)`,
          zIndex: containsSelected ? 550 : 350,
          image: createClusterPinIcon(cluster, isNearest),
        });

        window.kakao.maps.event.addListener(clusterMarker, 'click', () => {
          expandSpider(cluster, clusterMarker, centerItem);
        });

        markersRef.current.push(clusterMarker);
      }
    });
  }, [facilities, selectedFacility?.id, collapseSpider, onSelectFacility, panToWithOffset]);

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
      content: '<div style="width: 12px; height: 12px; background: #3b82f6; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 6px rgba(0,0,0,0.35);"></div>',
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
        strokeOpacity: 0.8,
        strokeWeight: 2.2,
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
        if (infoWindowRef.current) infoWindowRef.current.close();
        iw.open(map, spiderPin);
        infoWindowRef.current = iw;
        panToWithOffset(new window.kakao.maps.LatLng(spiderPos.lat, spiderPos.lng), 90);
        onSelectFacility(item);
      });

      spiderDataRef.current.markers.push({ marker: spiderPin, infoWindow: iw, item });
    });

    onOpenCluster(cluster);
    onToast(`🏢 밀집 시설 ${cluster.length}대가 펼쳐졌습니다. 핀이나 목록을 터치하세요.`);
  };

  // 4. 도보 내비게이션 경로선 (Polyline) 및 실내 진입 점선 렌더링
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
      const path = navRouteCoordinates.map(
        (c) => new window.kakao.maps.LatLng(c[1], c[0])
      );

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
      if (selectedFacility) {
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
      if (selectedFacility) {
        bounds.extend(new window.kakao.maps.LatLng(selectedFacility.lat, selectedFacility.lon));
      }
      map.setBounds(bounds);
      setTimeout(() => {
        if (mapRef.current) mapRef.current.panBy(0, 70);
      }, 50);
    }
  }, [navRouteCoordinates, selectedFacility]);

  // FAB 버튼 핸들러들
  const handleSnapUserGps = () => {
    if (!mapRef.current) return;
    if (onRequestGps) {
      onRequestGps();
    }
    const pos = new window.kakao.maps.LatLng(userCoords.lat, userCoords.lon);
    panToWithOffset(pos, 60);
    mapRef.current.setLevel(3);
    onToast('📍 내 위치로 지도를 이동하고 GPS를 갱신했습니다.');
  };

  const handleReSearchArea = () => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    onReSearch(center.getLat(), center.getLng());
  };

  const handleToggleMapLayer = () => {
    if (!mapRef.current) return;
    const nextSkyview = !isSkyview;
    setIsSkyview(nextSkyview);
    if (nextSkyview) {
      mapRef.current.setMapTypeId(window.kakao.maps.MapTypeId.HYBRID);
      onToast('스카이뷰(위성사진)로 전환했습니다.');
    } else {
      mapRef.current.setMapTypeId(window.kakao.maps.MapTypeId.ROADMAP);
      onToast('일반 지도로 전환했습니다.');
    }
  };

  return (
    <>
      <div id="mainMap" ref={mapContainerRef} className="map-view" />

      {/* 우측 상단 플로팅 툴바 (FAB) - Zen Mode 시 페이드 아웃 */}
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
