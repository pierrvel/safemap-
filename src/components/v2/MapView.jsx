import React, { useEffect, useRef, useCallback, useState } from 'react';
import { LocateFixed, Plus, Minus, WifiOff } from 'lucide-react';
import {
  createCustomPinIcon,
  createClusterPinIcon,
  createUserLocationIcon,
  calculateSpiderPositions,
  calculateDistanceMeters,
} from '../../utils/mapIcons';

const ROUTE_RED = '#E5304A';
const ROUTE_RED_SOFT = '#F0828F';

// 20m 이내 동일 건물/초근접 겹침 시설 그룹화
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

// 서버·폴백이 주는 여러 좌표 형식을 카카오 LatLng 배열로 변환
function toLatLngPath(coordinates) {
  return (coordinates || [])
    .map((pt) => {
      if (!pt) return null;
      let lat;
      let lon;
      if (Array.isArray(pt)) {
        [lat, lon] = pt[0] > 90 ? [pt[1], pt[0]] : [pt[0], pt[1]];
      } else {
        lat = pt.lat ?? pt.latitude ?? pt.y;
        lon = pt.lng ?? pt.lon ?? pt.longitude ?? pt.x;
      }
      const numLat = parseFloat(lat);
      const numLon = parseFloat(lon);
      if (Number.isFinite(numLat) && Number.isFinite(numLon) && numLat > 0 && numLon > 0) {
        return new window.kakao.maps.LatLng(numLat, numLon);
      }
      return null;
    })
    .filter(Boolean);
}

export default function MapView({
  isLoaded,
  userCoords,
  facilities = [],
  selectedFacility,
  onSelectFacility,
  navRouteCoordinates,
  previewRoute = null,
  focusPoints = null,
  bottomOffset = 0,
  leftInset = 0,
  onCameraMove,
  onRequestGps,
  showControls = true,
  unavailableMessage = null,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const markerMapRef = useRef(new Map());
  const spiderMarkersRef = useRef([]);
  const spiderLinesRef = useRef([]);
  const activeClusterIdRef = useRef(null);
  const routeLinesRef = useRef([]);
  const bubbleRef = useRef(null);
  const isInitialCenteringDone = useRef(false);
  // 지도보다 위치·시설이 먼저 도착해도 마커가 빠지지 않도록 지도 준비 상태를 의존성으로 사용
  const [mapReady, setMapReady] = useState(false);

  // 재사용되는 마커의 클릭 핸들러가 오래된 시설 데이터·함수를 쓰지 않도록 최신값을 ref로 보관
  const latestFacilitiesRef = useRef(new Map());
  latestFacilitiesRef.current = new Map(facilities.map((f) => [f.id, f]));
  const onSelectFacilityRef = useRef(onSelectFacility);
  onSelectFacilityRef.current = onSelectFacility;
  const selectLatest = useCallback((fac) => {
    onSelectFacilityRef.current?.(latestFacilitiesRef.current.get(fac.id) || fac);
  }, []);
  const getLatestGroup = (group) => group.map((f) => latestFacilitiesRef.current.get(f.id) || f);

  const insetsRef = useRef({ left: leftInset });
  insetsRef.current = { left: leftInset };

  // 시트에 가려지지 않게 경로·핀이 보이도록 화면 맞춤
  const fitToPath = useCallback((path) => {
    if (!mapRef.current || path.length === 0) return;
    const bounds = new window.kakao.maps.LatLngBounds();
    path.forEach((pt) => bounds.extend(pt));
    const { left } = insetsRef.current;
    mapRef.current.setBounds(bounds, 96, 72, 56, left + 56);
  }, []);

  const collapseSpider = useCallback(() => {
    spiderMarkersRef.current.forEach((m) => m.setMap(null));
    spiderMarkersRef.current = [];
    spiderLinesRef.current.forEach((l) => l.setMap(null));
    spiderLinesRef.current = [];
    activeClusterIdRef.current = null;
  }, []);

  // 1. 지도 초기화 (최초 1회만 내 위치로 중심 설정)
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapRef.current) return;

    const hasUserCoords = !!(userCoords?.lat && userCoords?.lon);
    const initialPos = hasUserCoords
      ? new window.kakao.maps.LatLng(userCoords.lat, userCoords.lon)
      : new window.kakao.maps.LatLng(37.5665, 126.9780);

    const map = new window.kakao.maps.Map(mapContainerRef.current, {
      center: initialPos,
      level: 3,
      draggable: true,
      scrollwheel: true,
    });
    mapRef.current = map;
    isInitialCenteringDone.current = hasUserCoords;
    setMapReady(true);

    window.kakao.maps.event.addListener(map, 'click', collapseSpider);

    // 지도를 끌면 내 위치는 그대로 두고 카메라 중심만 알림
    window.kakao.maps.event.addListener(map, 'dragend', () => {
      const center = map.getCenter();
      onCameraMove?.({ lat: center.getLat(), lon: center.getLng() });
    });
  }, [isLoaded, onCameraMove, collapseSpider]);

  // 지도는 시트 위쪽까지만 차지 (카카오 로고·축척이 가리지 않게): 크기가 바뀌면 다시 배치
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    mapRef.current.relayout();
    mapRef.current.setCopyrightPosition(
      leftInset > 0 ? window.kakao.maps.CopyrightPosition.BOTTOMRIGHT : window.kakao.maps.CopyrightPosition.BOTTOMLEFT,
      true
    );
  }, [bottomOffset, leftInset, mapReady]);

  // 도착 등: 주어진 지점(내 위치·목적지)이 모두 보이게 맞춤
  const focusKey = focusPoints
    ? focusPoints.map((pt) => `${pt?.lat?.toFixed(5)},${pt?.lon?.toFixed(5)}`).join('|')
    : '';
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps || !focusPoints?.length) return undefined;
    const pts = focusPoints.filter((pt) => pt?.lat && pt?.lon);
    if (!pts.length) return undefined;
    // 시트 높이 변화로 지도가 다시 배치된 뒤에 맞춤
    const timer = setTimeout(() => {
      const map = mapRef.current;
      if (!map) return;
      map.relayout();
      const spread = pts.length > 1 ? calculateDistanceMeters(pts[0].lat, pts[0].lon, pts[1].lat, pts[1].lon) : 0;
      if (spread < 40) {
        map.setLevel(2);
        map.setCenter(new window.kakao.maps.LatLng(pts[pts.length - 1].lat, pts[pts.length - 1].lon));
      } else {
        fitToPath(pts.map((pt) => new window.kakao.maps.LatLng(pt.lat, pt.lon)));
      }
    }, 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, bottomOffset, mapReady, fitToPath]);

  // 창 크기가 바뀌면 지도 다시 배치
  useEffect(() => {
    const handleResize = () => mapRef.current?.relayout();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 2. 내 위치 마커
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    if (!userCoords?.lat || !userCoords?.lon) {
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = null;
      return;
    }

    const pos = new window.kakao.maps.LatLng(userCoords.lat, userCoords.lon);
    if (!userMarkerRef.current) {
      userMarkerRef.current = new window.kakao.maps.Marker({
        position: pos,
        image: createUserLocationIcon(),
        map: mapRef.current,
        zIndex: 15,
      });
    } else {
      userMarkerRef.current.setMap(mapRef.current);
      userMarkerRef.current.setPosition(pos);
    }

    if (!isInitialCenteringDone.current) {
      mapRef.current.setCenter(pos);
      isInitialCenteringDone.current = true;
    }
  }, [userCoords, mapReady]);

  // 3. 겹친 시설 펼치기
  const expandSpider = useCallback((cluster, centerPos, clusterId) => {
    if (activeClusterIdRef.current === clusterId) {
      collapseSpider();
      return;
    }
    collapseSpider();
    activeClusterIdRef.current = clusterId;

    calculateSpiderPositions(cluster, centerPos).forEach(({ item, spiderPos }) => {
      const spLatLng = new window.kakao.maps.LatLng(spiderPos.lat, spiderPos.lng);
      const centerLatLng = new window.kakao.maps.LatLng(centerPos.lat, centerPos.lng);

      spiderLinesRef.current.push(
        new window.kakao.maps.Polyline({
          map: mapRef.current,
          path: [centerLatLng, spLatLng],
          strokeWeight: 2,
          strokeColor: '#8B95A1',
          strokeOpacity: 0.8,
          strokeStyle: 'shortdash',
          zIndex: 5,
        })
      );

      const isSelected = selectedFacility?.id === item.id;
      const spMarker = new window.kakao.maps.Marker({
        map: mapRef.current,
        position: spLatLng,
        image: createCustomPinIcon(item, false, isSelected),
        zIndex: isSelected ? 35 : 30,
      });
      spMarker.item = item;

      window.kakao.maps.event.addListener(spMarker, 'click', () => {
        selectLatest(item);
        spiderMarkersRef.current.forEach((m) => {
          if (!m?.item) return;
          const isThisSelected = m.item.id === item.id;
          m.setImage(createCustomPinIcon(m.item, false, isThisSelected));
          m.setZIndex(isThisSelected ? 35 : 30);
        });
      });

      spiderMarkersRef.current.push(spMarker);
    });
  }, [collapseSpider, selectedFacility, selectLatest]);
  const expandSpiderRef = useRef(expandSpider);
  expandSpiderRef.current = expandSpider;

  // 4. 시설 마커 (재사용 풀링, 선택된 시설만 크게)
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    const currentMap = markerMapRef.current;
    // 답으로 고른 시설은 묶음에 넣지 않고 항상 실제 좌표에 큰 핀으로
    const selected = selectedFacility ? facilities.find((f) => f.id === selectedFacility.id) || selectedFacility : null;
    const others = selected ? facilities.filter((f) => f.id !== selected.id) : facilities;
    const clusters = [...(selected ? [[selected]] : []), ...groupOverlappingFacilities(others)];
    const nextKeys = new Set();

    clusters.forEach((group) => {
      if (group.length === 1) {
        const fac = group[0];
        const key = fac.id;
        nextKeys.add(key);
        const isSelected = selectedFacility?.id === fac.id;

        if (currentMap.has(key)) {
          const entry = currentMap.get(key);
          if (entry.isSelected !== isSelected) {
            entry.marker.setImage(createCustomPinIcon(fac, false, isSelected));
            entry.marker.setZIndex(isSelected ? 16 : 4);
            entry.isSelected = isSelected;
          }
        } else {
          const pos = new window.kakao.maps.LatLng(fac.lat, fac.lon);
          const marker = new window.kakao.maps.Marker({
            position: pos,
            image: createCustomPinIcon(fac, false, isSelected),
            map: mapRef.current,
            zIndex: isSelected ? 16 : 4,
            title: fac.name,
          });
          window.kakao.maps.event.addListener(marker, 'click', () => {
            collapseSpider();
            selectLatest(fac);
          });
          currentMap.set(key, { marker, isSelected });
        }
      } else {
        const clusterKey = `cluster-${group.map((f) => f.id).sort().join('-')}`;
        nextKeys.add(clusterKey);
        const isSelected = group.some((f) => f.id === selectedFacility?.id);

        if (currentMap.has(clusterKey)) {
          const entry = currentMap.get(clusterKey);
          if (entry.isSelected !== isSelected) {
            entry.marker.setImage(createClusterPinIcon(group, isSelected));
            entry.marker.setZIndex(isSelected ? 10 : 5);
            entry.isSelected = isSelected;
          }
        } else {
          const avgLat = group.reduce((sum, f) => sum + f.lat, 0) / group.length;
          const avgLon = group.reduce((sum, f) => sum + f.lon, 0) / group.length;
          const centerPos = { lat: avgLat, lng: avgLon };
          const marker = new window.kakao.maps.Marker({
            position: new window.kakao.maps.LatLng(avgLat, avgLon),
            image: createClusterPinIcon(group, isSelected),
            map: mapRef.current,
            zIndex: isSelected ? 10 : 5,
            title: `같은 건물 ${group.length}곳 (눌러서 펼치기)`,
          });
          window.kakao.maps.event.addListener(marker, 'click', () => {
            expandSpiderRef.current(getLatestGroup(group), centerPos, clusterKey);
          });
          currentMap.set(clusterKey, { marker, isSelected });
        }
      }
    });

    for (const [key, entry] of currentMap.entries()) {
      if (!nextKeys.has(key)) {
        entry.marker.setMap(null);
        currentMap.delete(key);
      }
    }
  }, [facilities, selectedFacility, collapseSpider, selectLatest, mapReady]);

  // 5. 경로선: 길안내 중에는 진한 빨강, 첫 화면 미리보기는 연한 빨강 + 시간 말풍선
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;

    routeLinesRef.current.forEach((l) => l.setMap(null));
    routeLinesRef.current = [];
    bubbleRef.current?.setMap(null);
    bubbleRef.current = null;

    const isNav = !!navRouteCoordinates?.length;
    const coords = isNav ? navRouteCoordinates : previewRoute?.coordinates;
    if (!coords?.length) return;

    try {
      const path = toLatLngPath(coords);
      if (path.length === 0) return;

      const casing = new window.kakao.maps.Polyline({
        path,
        strokeWeight: isNav ? 11 : 9,
        strokeColor: '#FFFFFF',
        strokeOpacity: 1,
        zIndex: 2,
      });
      const line = new window.kakao.maps.Polyline({
        path,
        strokeWeight: isNav ? 7 : 5,
        strokeColor: isNav ? ROUTE_RED : ROUTE_RED_SOFT,
        strokeOpacity: 1,
        strokeStyle: previewRoute?.isEstimate && !isNav ? 'shortdash' : 'solid',
        zIndex: 3,
      });
      casing.setMap(mapRef.current);
      line.setMap(mapRef.current);
      routeLinesRef.current = [casing, line];

      if (!isNav && previewRoute?.label) {
        const content = document.createElement('div');
        content.className = 'sm-route-bubble';
        content.textContent = previewRoute.label;
        bubbleRef.current = new window.kakao.maps.CustomOverlay({
          position: path[Math.floor(path.length / 2)],
          content,
          yAnchor: 1.5,
          zIndex: 20,
        });
        bubbleRef.current.setMap(mapRef.current);
      }

      fitToPath(path);
    } catch (err) {
      console.error('Route render error:', err);
    }
  }, [navRouteCoordinates, previewRoute, fitToPath, mapReady]);

  const handleZoom = (delta) => {
    if (!mapRef.current) return;
    mapRef.current.setLevel(mapRef.current.getLevel() + delta, { animate: true });
  };

  const handleSnapGps = () => {
    if (mapRef.current && userCoords?.lat && userCoords?.lon) {
      mapRef.current.panTo(new window.kakao.maps.LatLng(userCoords.lat, userCoords.lon));
    }
    onRequestGps?.();
  };

  return (
    <div className="sm-map" style={{ bottom: bottomOffset }}>
      <div ref={mapContainerRef} className="sm-map-canvas" aria-label="주변 시설 지도" />

      {unavailableMessage && (
        <div className="sm-map-unavailable" role="status">
          <WifiOff size={20} aria-hidden="true" />
          <span>{unavailableMessage}</span>
        </div>
      )}

      {showControls && (
        <div className="sm-map-controls">
          <button type="button" className="sm-fab" onClick={handleSnapGps} aria-label="내 위치로 이동">
            <LocateFixed size={22} strokeWidth={2.2} />
          </button>
          <button type="button" className="sm-fab sm-fab-zoom" onClick={() => handleZoom(-1)} aria-label="지도 확대">
            <Plus size={22} strokeWidth={2.2} />
          </button>
          <button type="button" className="sm-fab sm-fab-zoom" onClick={() => handleZoom(1)} aria-label="지도 축소">
            <Minus size={22} strokeWidth={2.2} />
          </button>
        </div>
      )}
    </div>
  );
}
