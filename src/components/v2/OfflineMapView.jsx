import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { FileSource, PMTiles, Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';
import { LocateFixed, Plus, Minus } from 'lucide-react';
import { clusterSvg, groupOverlappingFacilities, pinSvg, userLocationSvg } from '../../utils/mapIcons';
import { loadMapBlob } from '../../utils/offlineMapStore';
import { formatDistance } from '../../utils/format';

const ROUTE_RED = '#E5304A';
const ROUTE_RED_SOFT = '#F08A99';

// 세이프맵 톤(A안): 회색 바탕 + 하얀 길 + 연한 공원·물, 글자는 회색 단계
function safemapFlavor() {
  const base = namedFlavor('light');
  return {
    ...base,
    background: '#F2F4F6',
    earth: '#F2F4F6',
    park_a: '#E3EFE3',
    park_b: '#DCEBDC',
    wood_a: '#E3EFE3',
    wood_b: '#DCEBDC',
    scrub_a: '#E6EFE4',
    scrub_b: '#E6EFE4',
    water: '#D6E6F5',
    buildings: '#E5E8EB',
    hospital: '#F6ECEC',
    school: '#EEF0F2',
    industrial: '#EEF0F2',
    residential: '#F2F4F6',
    commercial: '#EEF0F2',
    railway: '#C9CED6',
    minor_a: '#FFFFFF',
    minor_b: '#FFFFFF',
    minor_service: '#FFFFFF',
    other: '#FFFFFF',
    pedestrian: '#F7F8FA',
    major: '#FFFFFF',
    highway: '#FFF4D6',
    highway_casing_early: '#E5E8EB',
    highway_casing_late: '#E5E8EB',
    roads_label_minor: '#8B95A1',
    roads_label_major: '#6B7684',
    city_label: '#4E5968',
    subplace_label: '#8B95A1',
    pois: { ...base.pois, gray: '#8B95A1' },
  };
}

// 길을 찾을 때 기준이 되는 장소만 남긴다 (식당·카페 아이콘은 AED 핀을 가린다)
// (지도 아이콘 묶음에 그림이 있는 종류만)
const LANDMARK_KINDS = ['station', 'subway', 'train_station', 'hospital', 'park', 'school', 'university', 'library', 'stadium'];

let protocol = null;
function getProtocol() {
  if (!protocol) {
    protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
  }
  return protocol;
}

function markerElement(svg, label, onClick) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'sm-offline-pin';
  el.setAttribute('aria-label', label);
  el.innerHTML = svg;
  if (onClick) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
  } else {
    el.tabIndex = -1;
  }
  return el;
}

/**
 * 인터넷이 없을 때의 지도 (OpenStreetMap, 휴대폰에 저장한 시·도 지도 파일)
 * - 카카오 지도와 같은 핀·내 위치·경로선을 쓰고, 겹친 시설은 숫자 묶음으로 보여 눌러서 확대한다
 */
export default function OfflineMapView({
  region,
  userCoords,
  facilities = [],
  selectedFacility,
  onSelectFacility,
  navRouteCoordinates,
  emphasizeAll = false,
  bottomOffset = 0,
  leftInset = 0,
  showControls = true,
  showBadge = true,
  onRequestGps,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const bubbleRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const onSelectRef = useRef(onSelectFacility);
  onSelectRef.current = onSelectFacility;

  // 1. 지도 만들기 (저장한 지도 파일을 바로 읽는다)
  useEffect(() => {
    let cancelled = false;
    let map = null;
    (async () => {
      const record = await loadMapBlob(region);
      if (cancelled) return;
      if (!record) {
        setFailed(true);
        return;
      }
      const file = new File([record.blob], record.file || `${region}.pmtiles`);
      getProtocol().add(new PMTiles(new FileSource(file)));
      const center = userCoords?.lat ? [userCoords.lon, userCoords.lat] : undefined;
      map = new maplibregl.Map({
        container: containerRef.current,
        center,
        zoom: 16.4,
        maxZoom: 19,
        attributionControl: { compact: true },
        // 한글은 휴대폰 글꼴로 그린다 (오프라인에서도 글꼴 파일이 필요 없음)
        localIdeographFontFamily: "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
        style: {
          version: 8,
          glyphs: `${window.location.origin}/map-assets/fonts/{fontstack}/{range}.pbf`,
          sprite: `${window.location.origin}/map-assets/sprites/light`,
          sources: {
            protomaps: { type: 'vector', url: `pmtiles://${file.name}`, attribution: '© OpenStreetMap' },
          },
          layers: layers('protomaps', safemapFlavor(), { lang: 'ko' }),
        },
      });
      mapRef.current = map;
      map.on('load', () => {
        if (map.getLayer('pois')) map.setFilter('pois', ['in', ['get', 'kind'], ['literal', LANDMARK_KINDS]]);
        map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 9, 'line-opacity': 0.9 } });
        map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 5, 'line-dasharray': ['case', ['get', 'dashed'], ['literal', [1.2, 1.2]], ['literal', [1, 0]]] } });
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      userMarkerRef.current = null;
      bubbleRef.current = null;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // 지역이 바뀔 때만 지도를 새로 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  // 시트 높이가 바뀌면 지도 크기를 다시 맞춘다
  useEffect(() => {
    mapRef.current?.resize();
  }, [bottomOffset, leftInset, ready]);

  // 2. 내 위치
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !userCoords?.lat) return;
    if (!userMarkerRef.current) {
      const { svg } = userLocationSvg();
      userMarkerRef.current = new maplibregl.Marker({ element: markerElement(svg, '내 위치'), anchor: 'center' })
        .setLngLat([userCoords.lon, userCoords.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userCoords.lon, userCoords.lat]);
    }
  }, [ready, userCoords?.lat, userCoords?.lon]);

  // 3. 시설 핀 (고른 시설은 묶음에서 빼고 크게)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const selected = selectedFacility ? facilities.find((f) => f.id === selectedFacility.id) || selectedFacility : null;
    const others = selected ? facilities.filter((f) => f.id !== selected.id) : facilities;
    groupOverlappingFacilities(others).forEach((group) => {
      if (group.length === 1) {
        const fac = group[0];
        const { svg } = pinSvg(fac, false, false, emphasizeAll);
        markersRef.current.push(
          new maplibregl.Marker({ element: markerElement(svg, fac.buildPlace || fac.name, () => onSelectRef.current?.(fac)), anchor: 'center' })
            .setLngLat([fac.lon, fac.lat])
            .addTo(map)
        );
      } else {
        const lat = group.reduce((s, f) => s + f.lat, 0) / group.length;
        const lon = group.reduce((s, f) => s + f.lon, 0) / group.length;
        const { svg } = clusterSvg(group, false, emphasizeAll);
        // 오프라인 지도에서는 펼치는 대신 눌러서 확대한다
        markersRef.current.push(
          new maplibregl.Marker({
            element: markerElement(svg, `같은 건물 ${group.length}곳`, () => map.easeTo({ center: [lon, lat], zoom: Math.min(19, map.getZoom() + 2) })),
            anchor: 'center',
          })
            .setLngLat([lon, lat])
            .addTo(map)
        );
      }
    });
    if (selected) {
      const { svg } = pinSvg(selected, false, true);
      const marker = new maplibregl.Marker({ element: markerElement(svg, selected.buildPlace || selected.name), anchor: 'center' })
        .setLngLat([selected.lon, selected.lat])
        .addTo(map);
      marker.getElement().style.zIndex = '3';
      markersRef.current.push(marker);
    }
  }, [ready, facilities, selectedFacility, emphasizeAll]);

  // 4. 경로선: 길안내 중에는 진한 빨강 실선, 첫 화면은 연한 빨강 점선 + 직선 거리 말풍선
  const selLat = selectedFacility?.lat;
  const selLon = selectedFacility?.lon;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !map.getSource('route')) return;
    bubbleRef.current?.remove();
    bubbleRef.current = null;

    let coords = null;
    let navigating = false;
    if (navRouteCoordinates?.length > 1) {
      coords = navRouteCoordinates.map((p) => [p.lng ?? p.lon, p.lat]);
      navigating = true;
    } else if (userCoords?.lat && Number.isFinite(selLat)) {
      coords = [[userCoords.lon, userCoords.lat], [selLon, selLat]];
    }
    map.getSource('route').setData({
      type: 'FeatureCollection',
      features: coords
        ? [{ type: 'Feature', properties: { color: navigating ? ROUTE_RED : ROUTE_RED_SOFT, dashed: !navigating }, geometry: { type: 'LineString', coordinates: coords } }]
        : [],
    });
    if (!coords) return;

    if (!navigating) {
      const meters = Math.round(new maplibregl.LngLat(...coords[0]).distanceTo(new maplibregl.LngLat(...coords[1])));
      const el = document.createElement('div');
      el.className = 'sm-route-bubble';
      el.textContent = `직선 ${formatDistance(meters)}`;
      bubbleRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -14] })
        .setLngLat([(coords[0][0] + coords[1][0]) / 2, (coords[0][1] + coords[1][1]) / 2])
        .addTo(map);
    }
    // 내 위치와 목적지가 함께 보이게
    const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    map.fitBounds(bounds, { padding: { top: 120, bottom: 72, left: 56 + leftInset, right: 72 }, maxZoom: 17.5, duration: 400 });
    // 위치가 조금씩 바뀔 때마다 화면을 다시 맞추지 않도록 목적지·길안내 경로가 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selLat, selLon, navRouteCoordinates]);

  const recenter = () => {
    onRequestGps?.();
    if (mapRef.current && userCoords?.lat) mapRef.current.easeTo({ center: [userCoords.lon, userCoords.lat], zoom: Math.max(16, mapRef.current.getZoom()) });
  };

  return (
    <div className="sm-map" style={{ bottom: bottomOffset }}>
      <div ref={containerRef} className="sm-map-canvas" aria-label="저장한 오프라인 지도" />
      {showBadge && <div className="sm-offline-badge">인터넷 없이 저장한 지도</div>}
      {failed && (
        <div className="sm-map-unavailable" role="status">
          <span>저장한 지도를 열지 못했어요. 아래에 적힌 방향과 거리를 보고 이동해 주세요.</span>
        </div>
      )}
      {showControls && (
        <div className="sm-map-controls">
          <button type="button" className="sm-fab" onClick={recenter} aria-label="내 위치로 이동">
            <LocateFixed size={24} strokeWidth={2.2} />
          </button>
          <button type="button" className="sm-fab sm-fab-zoom" onClick={() => mapRef.current?.zoomIn()} aria-label="지도 확대">
            <Plus size={22} strokeWidth={2.2} />
          </button>
          <button type="button" className="sm-fab sm-fab-zoom" onClick={() => mapRef.current?.zoomOut()} aria-label="지도 축소">
            <Minus size={22} strokeWidth={2.2} />
          </button>
        </div>
      )}
    </div>
  );
}
