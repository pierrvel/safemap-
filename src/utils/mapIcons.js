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

export function createCustomPinIcon(item, isNearest, isSelected) {
  let bgColor = '#ef4444';
  let iconEmoji = '⚡';
  let catText = 'AED';

  if (item.category === 'extinguisher') {
    bgColor = '#f97316';
    iconEmoji = '🧯';
    catText = '소화기';
  } else if (item.category === 'hydrant') {
    bgColor = '#2563eb';
    iconEmoji = '💧';
    catText = '소화전';
  }

  const strokeColor = isSelected ? '#2563eb' : (isNearest ? '#f59e0b' : '#ffffff');
  const strokeWidth = isSelected ? 3.5 : (isNearest ? 3 : 2);
  const scale = isNearest || isSelected ? 1.15 : 1.0;

  const w = Math.round(36 * scale);
  const h = Math.round(46 * scale);

  const goldHalo = isNearest ? `<circle cx="18" cy="17" r="16" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="3,2" />` : '';

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 36 46">
    <defs>
      <filter id="p-sh-${item.id}" x="-30%" y="-20%" width="160%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.32"/>
      </filter>
    </defs>
    ${goldHalo}
    <path d="M 18 2 C 9.5 2, 3 8.8, 3 17.5 C 3 28, 18 44, 18 44 C 18 44, 33 28, 33 17.5 C 33 8.8, 26.5 2, 18 2 Z"
          fill="${bgColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" filter="url(#p-sh-${item.id})" />
    <circle cx="18" cy="16.5" r="9.5" fill="#ffffff" />
    <text x="18" y="20.5" font-size="10.5" text-anchor="middle" font-family="'Apple Color Emoji','Segoe UI Emoji',sans-serif">${iconEmoji}</text>
    <rect x="5.5" y="30.5" width="25" height="10" rx="5" fill="${bgColor}" stroke="#ffffff" stroke-width="1" />
    <text x="18" y="38" font-size="7" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="'Pretendard', sans-serif">${catText}</text>
  </svg>`.trim();

  return new window.kakao.maps.MarkerImage(
    'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    new window.kakao.maps.Size(w, h),
    { offset: new window.kakao.maps.Point(w / 2, h) }
  );
}

export function createClusterPinIcon(cluster, isNearest) {
  const count = cluster.length;
  const hasAed = cluster.some(f => f.category === 'aed');
  const hasExt = cluster.some(f => f.category === 'extinguisher');
  const hasHyd = cluster.some(f => f.category === 'hydrant');

  let bgColor = '#7c3aed';
  let emoji = '🏢';
  if (hasAed && !hasExt && !hasHyd) {
    bgColor = '#ef4444';
    emoji = '⚡';
  } else if (!hasAed && hasExt && !hasHyd) {
    bgColor = '#f97316';
    emoji = '🧯';
  } else if (!hasAed && !hasExt && hasHyd) {
    bgColor = '#2563eb';
    emoji = '💧';
  }

  const w = 40;
  const h = 48;
  const strokeColor = isNearest ? '#f59e0b' : '#ffffff';

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 40 48">
    <defs>
      <filter id="c-sh" x="-30%" y="-20%" width="160%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <path d="M 20 2 C 10 2, 3 9, 3 18 C 3 29, 20 46, 20 46 C 20 46, 37 29, 37 18 C 37 9, 30 2, 20 2 Z"
          fill="${bgColor}" stroke="${strokeColor}" stroke-width="${isNearest ? 3 : 2}" filter="url(#c-sh)" />
    <circle cx="20" cy="17" r="11" fill="#ffffff" />
    <text x="20" y="21" font-size="11" text-anchor="middle" font-family="'Apple Color Emoji','Segoe UI Emoji',sans-serif">${emoji}</text>
    <rect x="7" y="32" width="26" height="11" rx="5.5" fill="#0f172a" stroke="#ffffff" stroke-width="1.2" />
    <text x="20" y="40.5" font-size="7.5" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="'Pretendard', sans-serif">${count}대 밀집</text>
  </svg>`.trim();

  return new window.kakao.maps.MarkerImage(
    'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    new window.kakao.maps.Size(w, h),
    { offset: new window.kakao.maps.Point(w / 2, h) }
  );
}

export function createUserLocationIcon() {
  const w = 36;
  const h = 46;
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 36 46">
    <defs>
      <filter id="u-sh" x="-30%" y="-20%" width="160%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
      </filter>
    </defs>
    <circle cx="18" cy="17" r="15" fill="#3b82f6" fill-opacity="0.25" />
    <path d="M 18 2 C 9.5 2, 3 8.8, 3 17.5 C 3 28, 18 44, 18 44 C 18 44, 33 28, 33 17.5 C 33 8.8, 26.5 2, 18 2 Z"
          fill="#1d4ed8" stroke="#ffffff" stroke-width="2" filter="url(#u-sh)" />
    <circle cx="18" cy="16.5" r="9.5" fill="#ffffff" />
    <circle cx="18" cy="16.5" r="5" fill="#2563eb" />
    <circle cx="18" cy="16.5" r="2" fill="#ffffff" />
    <rect x="5.5" y="30.5" width="25" height="10" rx="5" fill="#1d4ed8" stroke="#ffffff" stroke-width="1" />
    <text x="18" y="38" font-size="6.8" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="'Pretendard', sans-serif">내 위치</text>
  </svg>`.trim();

  return new window.kakao.maps.MarkerImage(
    'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    new window.kakao.maps.Size(w, h),
    { offset: new window.kakao.maps.Point(w / 2, h) }
  );
}

export function createFloatingPillContent(item) {
  const place = item.buildPlace || item.buildAddress || item.name;
  const isCalibrated = item.locationConfidence === 'CALIBRATED';
  const isEstimated = item.locationConfidence === 'ESTIMATED';
  const dotEmoji = isCalibrated ? '🔵' : (isEstimated ? '🟡' : '🟢');

  return `
    <div style="
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 11px;
      background: #0f172a;
      color: #ffffff;
      border-radius: 9999px;
      font-size: 11.5px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
      border: 1.5px solid #38bdf8;
      pointer-events: none;
      transform: translateY(-8px);
    ">
      <span>${dotEmoji}</span>
      <span style="max-width: 190px; overflow: hidden; text-overflow: ellipsis;">${place}</span>
    </div>
  `.trim();
}

export function createInfoWindowContent(item, isNearest) {
  let catIcon = '⚡';
  let catText = '자동심장충격기 (AED)';
  let catBg = '#fee2e2';
  let catColor = '#dc2626';

  if (item.category === 'extinguisher') {
    catIcon = '🧯';
    catText = '소화기 (소화시설)';
    catBg = '#ffedd5';
    catColor = '#ea580c';
  } else if (item.category === 'hydrant') {
    catIcon = '💧';
    catText = '소화전 (소방용수)';
    catBg = '#eff6ff';
    catColor = '#2563eb';
  }

  const distM = item.realDistanceMeters || item.distanceMeters || 0;
  const timeTxt = item.realDurationText || item.walkingTime || '';

  return `
    <div style="font-family: Pretendard, -apple-system, sans-serif; padding: 6px 4px; max-width: 250px; line-height: 1.45;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 6px;">
        <span style="font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: ${catBg}; color: ${catColor};">
          ${catIcon} ${catText}
        </span>
        ${isNearest ? '<span style="font-size: 10px; font-weight: 800; color: #d97706; background: #fef3c7; padding: 2px 6px; border-radius: 6px;">최단거리</span>' : ''}
      </div>
      <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${item.name || '안전시설'}
      </div>
      <div style="font-size: 11.5px; color: #2563eb; font-weight: 700; margin-bottom: 5px;">
        🏢 ${item.buildPlace || item.buildAddress || '위치 상세 정보 없음'}
      </div>
      <div style="font-size: 11px; color: #475569; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #f1f5f9; padding-top: 4px;">
        <span>도보 <strong>${distM}m</strong></span>
        <span>${timeTxt}</span>
      </div>
    </div>
  `.trim();
}

// 스파이더파이어 방사 오프셋 계산 함수
export function calculateSpiderPositions(cluster, centerPos) {
  const count = cluster.length;
  const radiusDeg = 0.00033; // 약 36m
  const centerLat = Number(centerPos.lat);
  const centerLon = Number(centerPos.lng ?? centerPos.lon);
  const latCos = Math.max(0.1, Math.cos(centerLat * Math.PI / 180));

  return cluster.map((item, index) => {
    let angle;
    if (count === 2) {
      angle = (index === 0) ? (-3 * Math.PI / 4) : (Math.PI / 4);
    } else {
      angle = (2 * Math.PI * index) / count - (Math.PI / 2);
    }

    const sLat = centerLat + radiusDeg * Math.cos(angle);
    const sLon = centerLon + (radiusDeg * Math.sin(angle)) / latCos;

    return {
      item,
      spiderPos: { lat: sLat, lng: sLon },
    };
  });
}
