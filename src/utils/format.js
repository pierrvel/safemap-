// 화면 문구용 거리·시간·상태 계산

// 실제 경로 시간이 있으면 그 값을, 없으면 직선거리에 우회 계수(1.25)와 보행 속도(1.25m/s)를 적용한 추정값
export function walkSeconds(facility) {
  if (!facility) return 0;
  if (Number.isFinite(facility.realDurationSeconds)) return facility.realDurationSeconds;
  const dist = facility.realDistanceMeters ?? facility.distanceMeters ?? 0;
  return Number.isFinite(facility.realDistanceMeters) ? dist / 1.25 : dist;
}

export function walkMinutes(facility) {
  return Math.max(1, Math.round(walkSeconds(facility) / 60));
}

export function walkDistance(facility) {
  if (!facility) return 0;
  return Math.round(facility.realDistanceMeters ?? facility.distanceMeters ?? 0);
}

export function formatDistance(meters) {
  const m = Math.round(meters);
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

// 'open' | 'closed' | 'unknown'
export function openState(facility) {
  if (facility?.availableNow === true) return 'open';
  if (facility?.availableNow === false) return 'closed';
  return 'unknown';
}

export const OPEN_STATE_TEXT = {
  open: '지금 이용 가능',
  closed: '지금은 닫혀 있어요',
  unknown: '운영시간 확인 안 됨',
};

// 건물 안 설치 위치: AED는 상세 위치, 대피소는 시설 이름
export function placeTitle(facility) {
  if (!facility) return '';
  if (facility.category === 'shelter') return facility.name || '민방위 대피소';
  return facility.buildPlace && facility.buildPlace !== '상세 위치 정보 없음'
    ? facility.buildPlace
    : facility.buildAddress || facility.name;
}

export function placeOwner(facility) {
  if (!facility) return '';
  if (facility.category === 'shelter') return facility.buildPlace || '';
  return facility.org && facility.org !== '관리기관 미상' ? facility.org : facility.buildAddress || '';
}

// 확실히 열린 AED가 미확인·닫힌 AED보다 도보 2분 이내로만 더 멀면 열린 AED를 기본 답으로
const OPEN_PREFERENCE_SECONDS = 120;

export function pickDefaultFacility(list) {
  if (!list?.length) return null;
  const nearest = list[0];
  if (nearest.category !== 'aed' || nearest.availableNow === true) return nearest;
  const open = list.find((f) => f.category === 'aed' && f.availableNow === true);
  if (!open) return nearest;
  if (nearest.availableNow === false) return open;
  return walkSeconds(open) - walkSeconds(nearest) <= OPEN_PREFERENCE_SECONDS ? open : nearest;
}
