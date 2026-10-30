// 카카오맵 커스텀 마커 SVG 및 스파이더파이어 분산 계산 유틸리티

export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// 디자인 토큰 (src/safemap.css 와 같은 값)
const AED_RED = '#E5304A';
const AED_RED_SOFT = '#F3A6B0';
const SHELTER_INK = '#333D4B';
const SHELTER_SOFT = '#8B95A1';
const USER_BLUE = '#3182F6';

// 24x24 좌표계 아이콘 경로
const HEART_PATH = 'M12 21s-7-4.35-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.65-9.5 9-9.5 9z';
const BOLT_PATH = 'M13 7.5l-3.5 5.5h3l-1.5 5 4.5-6.5h-3l1.5-4z';
const SHIELD_PATH = 'M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z';

function toMarkerImage(svg, size, offset) {
  return new window.kakao.maps.MarkerImage(
    'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    new window.kakao.maps.Size(size, size),
    { offset: new window.kakao.maps.Point(offset.x, offset.y) }
  );
}

// 둥근 사각형 핀: 강조(선택·가장 가까움)는 크게 진한 색, 나머지는 작고 연하게
// emphasize: 시트를 접어 지도를 넓게 볼 때는 나머지 시설도 진한 색 아이콘으로
function glyph(category, fg, bg, scale) {
  const t = `translate(${12 - 12 * scale} ${12 - 12 * scale}) scale(${scale})`;
  if (category === 'shelter') {
    return `<g transform="${t}"><path d="${SHIELD_PATH}" fill="${fg}"/></g>`;
  }
  return `<g transform="${t}"><path d="${HEART_PATH}" fill="${fg}"/><path d="${BOLT_PATH}" fill="${bg}"/></g>`;
}

export function createCustomPinIcon(item, isNearest, isSelected, emphasize = false) {
  const isShelter = item.category === 'shelter';
  const strong = isSelected || isNearest;
  const vivid = strong || emphasize;
  const fill = isShelter ? (vivid ? SHELTER_INK : SHELTER_SOFT) : (vivid ? AED_RED : AED_RED_SOFT);
  // 화면 크기와 별개로 터치 영역은 넉넉히 확보 (선택되지 않은 시설은 작은 점)
  const size = strong ? 60 : emphasize ? 44 : 36;
  const box = strong ? 52 : emphasize ? 32 : 16;
  const pad = (size - box) / 2;
  const radius = strong ? 17 : emphasize ? 11 : 6;

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect x="${pad}" y="${pad + 1}" width="${box}" height="${box}" rx="${radius}" fill="#191F28" fill-opacity="0.18"/>
    <rect x="${pad}" y="${pad}" width="${box}" height="${box}" rx="${radius}" fill="${fill}" stroke="#FFFFFF" stroke-width="${strong ? 3 : emphasize ? 2.5 : 2}"/>
    ${vivid ? `<svg x="${pad}" y="${pad}" width="${box}" height="${box}" viewBox="0 0 24 24">
      ${glyph(item.category, '#FFFFFF', fill, 0.62)}
    </svg>` : ''}
  </svg>`.trim();

  return toMarkerImage(svg, size, { x: size / 2, y: size / 2 });
}

export function createClusterPinIcon(cluster, isNearest, emphasize = false) {
  const count = cluster.length;
  const isShelter = cluster.every((f) => f.category === 'shelter');
  const vivid = isNearest || emphasize;
  const fill = isShelter ? (vivid ? SHELTER_INK : SHELTER_SOFT) : (vivid ? AED_RED : AED_RED_SOFT);
  const size = emphasize ? 46 : 40;
  const box = emphasize ? 34 : 26;
  const pad = (size - box) / 2;

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${emphasize ? `<rect x="${pad}" y="${pad + 1}" width="${box}" height="${box}" rx="11" fill="#191F28" fill-opacity="0.18"/>` : ''}
    <rect x="${pad}" y="${pad}" width="${box}" height="${box}" rx="${emphasize ? 11 : 9}" fill="${fill}" stroke="#FFFFFF" stroke-width="${emphasize ? 2.5 : 2}"/>
    <text x="${size / 2}" y="${size / 2 + (emphasize ? 5 : 4.5)}" font-size="${emphasize ? 15 : 13}" font-weight="700" fill="#FFFFFF" text-anchor="middle" font-family="Pretendard, -apple-system, sans-serif">${count}</text>
  </svg>`.trim();

  return toMarkerImage(svg, size, { x: size / 2, y: size / 2 });
}

export function createUserLocationIcon() {
  const size = 48;
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="22" fill="${USER_BLUE}" fill-opacity="0.16"/>
    <circle cx="24" cy="25" r="10" fill="#191F28" fill-opacity="0.16"/>
    <circle cx="24" cy="24" r="10" fill="${USER_BLUE}" stroke="#FFFFFF" stroke-width="4"/>
  </svg>`.trim();

  return toMarkerImage(svg, size, { x: size / 2, y: size / 2 });
}

// 겹친 시설 펼치기 배치: 화면 픽셀 기준으로 핀이 겹치지 않게 여러 겹의 원에 나눠 놓는다
// (줌 수준과 상관없이 같은 간격으로 보이도록 지도 투영으로 좌표를 바꾼다)
const SPIDER_FIRST_RING_PX = 56;
const SPIDER_SPACING_PX = 48;

export function calculateSpiderPositions(map, cluster, centerLatLng) {
  const projection = map.getProjection();
  const center = projection.containerPointFromCoords(centerLatLng);
  const positions = [];
  let placed = 0;
  let ring = 0;

  while (placed < cluster.length) {
    const radius = SPIDER_FIRST_RING_PX + ring * SPIDER_SPACING_PX;
    const capacity = Math.max(2, Math.floor((2 * Math.PI * radius) / SPIDER_SPACING_PX));
    const count = Math.min(capacity, cluster.length - placed);
    for (let i = 0; i < count; i++) {
      // 겹마다 조금씩 돌려 바깥 핀이 안쪽 핀 바로 뒤에 숨지 않게
      const angle = (2 * Math.PI * i) / count - Math.PI / 2 + ring * 0.3;
      const point = new window.kakao.maps.Point(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle));
      positions.push({ item: cluster[placed + i], position: projection.coordsFromContainerPoint(point) });
    }
    placed += count;
    ring += 1;
  }
  return positions;
}
