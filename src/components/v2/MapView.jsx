import React, { useEffect, useRef, useCallback } from 'react';
import { Crosshair } from 'lucide-react';
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
  const markerMapRef = useRef(new Map()); // id -> { marker, fac, isSelected, isNearest }
  const routePolylineRef = useRef(null);
  const isInitialCenteringDone = useRef(false);

  // 1. 지도 초기화 (최초 1회만 내 GPS 위치로 중심 설정)
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapRef.current) return;

    const hasUserCoords = !!(userCoords?.lat && userCoords?.lon);
    const initialPos = hasUserCoords
      ? new window.kakao.maps.LatLng(userCoords.lat, userCoords.lon)
      : new window.kakao.maps.LatLng(37.5665, 126.9780);

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
    isInitialCenteringDone.current = hasUserCoords;

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
  }, [isLoaded, onCameraMove]);

  // 2. 🌟 사용자 위치 마커 갱신 (지도를 아무리 움직여도 내 위치는 실제 GPS 좌표에 고정!)
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    if (!userCoords?.lat || !userCoords?.lon) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
      return;
    }

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
      userMarkerRef.current.setMap(mapRef.current);
      userMarkerRef.current.setPosition(pos);
    }

    // 아직 최초 중심 이동이 안 된 상태에서 유효 좌표가 들어왔을 때 지도 중심을 내 위치로 이동
    if (!isInitialCenteringDone.current) {
      mapRef.current.setCenter(pos);
      isInitialCenteringDone.current = true;
    }
  }, [userCoords]);

  // 3. 시설 마커 렌더링 (마커 재사용 풀링: 불필요한 DOM 파괴/생성 0회로 60fps 보장)
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    const currentMap = markerMapRef.current;
    const newIds = new Set(facilities.map((f) => f.id));

    // 1. 화면 범위 밖으로 사라진 마커만 지도에서 제거
    for (const [id, entry] of currentMap.entries()) {
      if (!newIds.has(id)) {
        entry.marker.setMap(null);
        currentMap.delete(id);
      }
    }

    // 2. 기존 마커는 이미지 및 zIndex만 갱신 (DOM 재생성 X)
    facilities.forEach((fac, idx) => {
      const pos = new window.kakao.maps.LatLng(fac.lat, fac.lon);
      const isNearest = idx === 0;
      const isSelected = selectedFacility?.id === fac.id;

      if (currentMap.has(fac.id)) {
        const entry = currentMap.get(fac.id);
        if (entry.isSelected !== isSelected || entry.isNearest !== isNearest) {
          entry.marker.setImage(createCustomPinIcon(fac, isNearest, isSelected));
          entry.marker.setZIndex(isSelected ? 9 : (isNearest ? 8 : 4));
          entry.isSelected = isSelected;
          entry.isNearest = isNearest;
        }
      } else {
        // 새로 발견된 시설만 마커 인스턴스 신규 생성
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

        currentMap.set(fac.id, {
          marker,
          fac,
          isSelected,
          isNearest,
        });
      }
    });
  }, [facilities, selectedFacility, onSelectFacility]);

  // 4. 도보 내비게이션 경로선 (Polyline) 렌더링 (배열 및 객체 좌표 완벽 파싱)
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }

    if (navRouteCoordinates && Array.isArray(navRouteCoordinates) && navRouteCoordinates.length > 0) {
      try {
        const linePath = navRouteCoordinates
          .map((pt) => {
            if (!pt) return null;
            let lat, lon;
            if (Array.isArray(pt)) {
              if (pt[0] > 90) {
                lon = pt[0];
                lat = pt[1];
              } else {
                lat = pt[0];
                lon = pt[1];
              }
            } else if (typeof pt === 'object') {
              lat = pt.lat !== undefined ? pt.lat : (pt.latitude !== undefined ? pt.latitude : pt.y);
              lon = pt.lng !== undefined ? pt.lng : (pt.lon !== undefined ? pt.lon : (pt.longitude !== undefined ? pt.longitude : pt.x));
            }
            const numLat = parseFloat(lat);
            const numLon = parseFloat(lon);
            if (!isNaN(numLat) && !isNaN(numLon) && numLat > 0 && numLon > 0) {
              return new window.kakao.maps.LatLng(numLat, numLon);
            }
            return null;
          })
          .filter(Boolean);

        if (linePath.length > 0) {
          const polyline = new window.kakao.maps.Polyline({
            path: linePath,
            strokeWeight: 6,
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
      } catch (err) {
        console.error('Polyline render error:', err);
      }
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
          <Crosshair size={18} />
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
