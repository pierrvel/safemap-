import React, { useEffect, useRef, useCallback } from 'react';
import { Crosshair, WifiOff } from 'lucide-react';
import {
  createCustomPinIcon,
  createClusterPinIcon,
  createUserLocationIcon,
  calculateSpiderPositions,
  calculateDistanceMeters,
} from '../../utils/mapIcons';

// 🌟 [3] 15m 이내 동일 건물/초근접 겹침 시설 그룹화 함수
function groupOverlappingFacilities(list) {
  const clusters = [];
  const visited = new Set();

  list.forEach((item) => {
    if (visited.has(item.id)) return;
    const group = [item];
    visited.add(item.id);

    list.forEach((other) => {
      if (visited.has(other.id)) return;
      const d = calculateDistanceMeters(item.lat, item.lon, other.lat, other.lon);
      if (d <= 20) {
        group.push(other);
        visited.add(other.id);
      }
    });

    clusters.push(group);
  });

  return clusters;
}

export default function MapView({
  isLoaded,
  userCoords,
  facilities = [],
  selectedFacility,
  onSelectFacility,
  navRouteCoordinates,
  onCameraMove,
  onRequestGps,
  unavailableMessage = null,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const markerMapRef = useRef(new Map()); // id -> { marker, entry, isSelected, isNearest }
  const spiderMarkersRef = useRef([]);
  const spiderLinesRef = useRef([]);
  const activeClusterIdRef = useRef(null);
  const routePolylineRef = useRef(null);
  const isInitialCenteringDone = useRef(false);

  // 재사용되는 마커의 클릭 핸들러가 생성 시점의 오래된 시설 데이터·함수를 쓰지 않도록 최신값을 ref로 보관
  const latestFacilitiesRef = useRef(new Map());
  latestFacilitiesRef.current = new Map(facilities.map((f) => [f.id, f]));
  const onSelectFacilityRef = useRef(onSelectFacility);
  onSelectFacilityRef.current = onSelectFacility;
  const selectLatest = useCallback((fac) => {
    onSelectFacilityRef.current?.(latestFacilitiesRef.current.get(fac.id) || fac);
  }, []);
  const getLatestGroup = (group) => group.map((f) => latestFacilitiesRef.current.get(f.id) || f);

  // 🌟 [3] 펼쳐진 스파이더파이 핀 및 점선 정리
  const collapseSpider = useCallback(() => {
    spiderMarkersRef.current.forEach((m) => m.setMap(null));
    spiderMarkersRef.current = [];
    spiderLinesRef.current.forEach((l) => l.setMap(null));
    spiderLinesRef.current = [];
    activeClusterIdRef.current = null;
  }, []);

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

    // 빈 지도 영역 클릭 시 펼쳐진 스파이더 핀 접기
    window.kakao.maps.event.addListener(map, 'click', () => {
      collapseSpider();
    });

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
  }, [isLoaded, onCameraMove, collapseSpider]);

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

  // 🌟 [3] 밀집/겹침 시설 스파이더파이 펼치기
  const expandSpider = useCallback((cluster, centerPos, clusterId) => {
    if (activeClusterIdRef.current === clusterId) {
      collapseSpider();
      return;
    }
    collapseSpider();
    activeClusterIdRef.current = clusterId;

    const spiders = calculateSpiderPositions(cluster, centerPos);
    spiders.forEach(({ item, spiderPos }) => {
      const spLatLng = new window.kakao.maps.LatLng(spiderPos.lat, spiderPos.lng);
      const centerLatLng = new window.kakao.maps.LatLng(centerPos.lat, centerPos.lng);

      // 1. 방사 점선 다리
      const legLine = new window.kakao.maps.Polyline({
        map: mapRef.current,
        path: [centerLatLng, spLatLng],
        strokeWeight: 2,
        strokeColor: '#2563eb',
        strokeOpacity: 0.75,
        strokeStyle: 'dashed',
        zIndex: 5,
      });
      spiderLinesRef.current.push(legLine);

      // 2. 방사 개별 마커
      const isNearest = item.id === facilities[0]?.id;
      const isSelected = selectedFacility?.id === item.id;
      const spMarker = new window.kakao.maps.Marker({
        map: mapRef.current,
        position: spLatLng,
        image: createCustomPinIcon(item, isNearest, isSelected),
        zIndex: isSelected ? 35 : 30,
      });

      spMarker.item = item;

      window.kakao.maps.event.addListener(spMarker, 'click', () => {
        selectLatest(item);
        // 펼쳐진 모든 자식 마커의 선택 상태 즉각 갱신
        spiderMarkersRef.current.forEach((m) => {
          if (!m || !m.item) return;
          const isThisSelected = m.item.id === item.id;
          const isThisNearest = m.item.id === facilities[0]?.id;
          m.setImage(createCustomPinIcon(m.item, isThisNearest, isThisSelected));
          m.setZIndex(isThisSelected ? 35 : 30);
        });
      });

      spiderMarkersRef.current.push(spMarker);
    });
  }, [collapseSpider, facilities, selectedFacility, selectLatest]);
  const expandSpiderRef = useRef(expandSpider);
  expandSpiderRef.current = expandSpider;

  // 3. 시설 마커 렌더링 (마커 재사용 풀링 & 겹침 마커 스파이더파이어)
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    const currentMap = markerMapRef.current;
    const clusters = groupOverlappingFacilities(facilities);
    const newClusterKeys = new Set();

    clusters.forEach((group) => {
      if (group.length === 1) {
        const fac = group[0];
        const key = fac.id;
        newClusterKeys.add(key);

        const pos = new window.kakao.maps.LatLng(fac.lat, fac.lon);
        const isNearest = fac.id === facilities[0]?.id;
        const isSelected = selectedFacility?.id === fac.id;

        if (currentMap.has(key)) {
          const entry = currentMap.get(key);
          if (entry.isSelected !== isSelected || entry.isNearest !== isNearest) {
            entry.marker.setImage(createCustomPinIcon(fac, isNearest, isSelected));
            entry.marker.setZIndex(isSelected ? 9 : (isNearest ? 8 : 4));
            entry.isSelected = isSelected;
            entry.isNearest = isNearest;
          }
        } else {
          const marker = new window.kakao.maps.Marker({
            position: pos,
            image: createCustomPinIcon(fac, isNearest, isSelected),
            map: mapRef.current,
            zIndex: isSelected ? 9 : (isNearest ? 8 : 4),
          });

          window.kakao.maps.event.addListener(marker, 'click', () => {
            collapseSpider();
            selectLatest(fac);
            if (mapRef.current) {
              mapRef.current.panTo(pos);
            }
          });

          currentMap.set(key, { marker, isCluster: false, fac, isSelected, isNearest });
        }
      } else {
        // 🌟 복수 시설 겹침 클러스터 마커 (터치 시 부채꼴 방사 펼침)
        const clusterKey = `cluster-${group.map((f) => f.id).sort().join('-')}`;
        newClusterKeys.add(clusterKey);

        const avgLat = group.reduce((sum, f) => sum + f.lat, 0) / group.length;
        const avgLon = group.reduce((sum, f) => sum + f.lon, 0) / group.length;
        const centerPos = { lat: avgLat, lng: avgLon };
        const centerLatLng = new window.kakao.maps.LatLng(avgLat, avgLon);

        const isNearest = group.some((f) => f.id === facilities[0]?.id);
        const isSelected = group.some((f) => f.id === selectedFacility?.id);

        if (currentMap.has(clusterKey)) {
          const entry = currentMap.get(clusterKey);
          if (entry.isSelected !== isSelected || entry.isNearest !== isNearest) {
            entry.marker.setImage(createClusterPinIcon(group, isNearest));
            entry.marker.setZIndex(isSelected ? 10 : (isNearest ? 8 : 5));
            entry.isSelected = isSelected;
            entry.isNearest = isNearest;
          }
        } else {
          const marker = new window.kakao.maps.Marker({
            position: centerLatLng,
            image: createClusterPinIcon(group, isNearest),
            map: mapRef.current,
            zIndex: isSelected ? 10 : (isNearest ? 8 : 5),
            title: `${group.length}개 시설 겹침 (터치하여 펼치기)`,
          });

          window.kakao.maps.event.addListener(marker, 'click', () => {
            expandSpiderRef.current(getLatestGroup(group), centerPos, clusterKey);
          });

          currentMap.set(clusterKey, {
            marker,
            isCluster: true,
            group,
            centerPos,
            isSelected,
            isNearest,
          });
        }
      }
    });

    // 화면 밖으로 사라진 마커 정리
    for (const [key, entry] of currentMap.entries()) {
      if (!newClusterKeys.has(key)) {
        entry.marker.setMap(null);
        currentMap.delete(key);
      }
    }
  }, [facilities, selectedFacility, collapseSpider, selectLatest]);

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
    // 위치 권한 거부 등으로 좌표가 없으면 지도 이동 없이 위치 재요청만 수행
    if (userCoords?.lat && userCoords?.lon) {
      const pos = new window.kakao.maps.LatLng(userCoords.lat, userCoords.lon);
      mapRef.current.panTo(pos);
    }
    onRequestGps?.();
  };

  return (
    <div className="v2-map-wrapper">
      <div id="v2MapContainer" ref={mapContainerRef} className="v2-map-canvas" />

      {/* 오프라인·지도 로드 실패 시 안내 */}
      {unavailableMessage && (
        <div className="v2-map-unavailable" role="status">
          <WifiOff size={20} />
          <span>{unavailableMessage}</span>
        </div>
      )}

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
