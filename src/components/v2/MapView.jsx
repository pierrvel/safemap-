import React, { useEffect, useRef, useCallback } from 'react';
import {
  createCustomPinIcon,
  createUserLocationIcon,
} from '../../utils/mapIcons';

export default function MapView({
  isLoaded,
  userCoords,
  facilities = [],
  selectedFacility,
  onSelectFacility,
  navRouteCoordinates,
  onCameraMove,
  onRequestGps,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const markersRef = useRef([]);
  const routePolylineRef = useRef(null);
  const isInitialCenteringDone = useRef(false);

  // 1. 지도 초기화 (최초 1회만 내 GPS 위치로 중심 설정)
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
    map.setDraggable(true);
    map.setZoomable(true);
    isInitialCenteringDone.current = true;

    // 🌟 핵심 수정: 지도 드래그 시 내 위치를 옮기지 않고, 카메라 중심 이동만 부모에 알림
    window.kakao.maps.event.addListener(map, 'dragend', () => {
      const center = map.getCenter();
      if (onCameraMove) {
        onCameraMove({
          lat: center.getLat(),
          lon: center.getLng(),
        });
      }
    });
  }, [isLoaded, userCoords, onCameraMove]);

  // 2. 🌟 사용자 위치 마커 갱신 (지도를 아무리 움직여도 내 위치는 실제 GPS 좌표에 고정!)
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    const pos = new window.kakao.maps.LatLng(userCoords.lat, userCoords.lon);

    if (!userMarkerRef.current) {
      const marker = new window.kakao.maps.Marker({
        position: pos,
        image: createUserLocationIcon(),
        map: mapRef.current,
        zIndex: 15,
      });
      userMarkerRef.current = marker;
    } else {
      userMarkerRef.current.setPosition(pos);
    }
  }, [userCoords]);

  // 3. 시설 마커 렌더링
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    // 기존 마커 제거
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const newMarkers = facilities.map((fac, idx) => {
      const pos = new window.kakao.maps.LatLng(fac.lat, fac.lon);
      const isNearest = idx === 0;
      const isSelected = selectedFacility?.id === fac.id;

      const marker = new window.kakao.maps.Marker({
        position: pos,
        image: createCustomPinIcon(fac, isNearest, isSelected),
        map: mapRef.current,
        zIndex: isSelected ? 9 : (isNearest ? 8 : 4),
      });

      window.kakao.maps.event.addListener(marker, 'click', () => {
        onSelectFacility(fac);
        if (mapRef.current) {
          mapRef.current.panTo(pos);
        }
      });

      return marker;
    });

    markersRef.current = newMarkers;
  }, [facilities, selectedFacility, onSelectFacility]);

  // 4. 도보 내비게이션 경로선 (Polyline) 렌더링
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }

    if (navRouteCoordinates && navRouteCoordinates.length > 0) {
      const linePath = navRouteCoordinates.map(
        ([lon, lat]) => new window.kakao.maps.LatLng(lat, lon)
      );

      const polyline = new window.kakao.maps.Polyline({
        path: linePath,
        strokeWeight: 7,
        strokeColor: '#2563eb',
        strokeOpacity: 0.9,
        strokeStyle: 'solid',
      });

      polyline.setMap(mapRef.current);
      routePolylineRef.current = polyline;

      // 경로 전체가 보이도록 바운즈 맞춤
      const bounds = new window.kakao.maps.LatLngBounds();
      linePath.forEach((pt) => bounds.extend(pt));
      mapRef.current.setBounds(bounds);
    }
  }, [navRouteCoordinates]);

  // 줌 컨트롤
  const handleZoomIn = () => {
    if (!mapRef.current) return;
    mapRef.current.setLevel(mapRef.current.getLevel() - 1);
  };

  const handleZoomOut = () => {
    if (!mapRef.current) return;
    mapRef.current.setLevel(mapRef.current.getLevel() + 1);
  };

  const handleSnapGps = () => {
    if (!mapRef.current) return;
    const pos = new window.kakao.maps.LatLng(userCoords.lat, userCoords.lon);
    mapRef.current.panTo(pos);
    onRequestGps?.();
  };

  return (
    <div className="v2-map-wrapper">
      <div id="v2MapContainer" ref={mapContainerRef} className="v2-map-canvas" />

      {/* 우측 플로팅 컨트롤 */}
      <div className="v2-map-fab-stack">
        <button
          type="button"
          className="v2-fab-btn gps"
          onClick={handleSnapGps}
          title="내 실제 위치로 지도 이동"
        >
          📍
        </button>
        <button
          type="button"
          className="v2-fab-btn"
          onClick={handleZoomIn}
          title="지도 확대"
        >
          ➕
        </button>
        <button
          type="button"
          className="v2-fab-btn"
          onClick={handleZoomOut}
          title="지도 축소"
        >
          ➖
        </button>
      </div>
    </div>
  );
}
