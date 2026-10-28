// Tmap (SK Open API) 보행자 경로 안내 연동 모듈
// 국내 도로망·골목길·신호등 횡단보도·육교·지하보도 및 아파트/학교 통행로 반영
const getTmapApiKey = () => process.env.TMAP_API_KEY || '';

// Tmap turnType 및 pointType을 앱 공통 방향 아이콘으로 매핑
function parseTmapTurnIcon(turnType, pointType) {
  const t = parseInt(turnType, 10);
  if (pointType === 'SP' || t === 200) return '🏁';
  if (pointType === 'EP' || t === 201) return '🎯';
  if ([12, 16, 17, 212, 214, 215].includes(t)) return '↰'; // 좌회전, 좌측 횡단보도
  if ([13, 18, 19, 213, 216, 217].includes(t)) return '↱'; // 우회전, 우측 횡단보도
  if (t === 14) return '🔄'; // U턴
  if ([11, 211].includes(t)) return '⬆️'; // 직진, 직진 횡단보도
  return '🚶';
}

/**
 * 티맵 보행자 단일 경로 및 턴바이턴 길안내 조회
 */
async function fetchTmapPedestrianRoute(oLat, oLon, dLat, dLon, startName = '출발지', endName = '목적지') {
  const appKey = getTmapApiKey();
  if (!appKey) return null;

  const url = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1';
  const body = {
    startX: oLon,
    startY: oLat,
    endX: dLon,
    endY: dLat,
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    startName: startName || '출발지',
    endName: endName || '목적지',
    searchOption: '0', // 0: 추천 (기본값)
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        appKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4500),
    });

    if (!res.ok) {
      console.warn('Tmap Pedestrian API returned status:', res.status);
      return null;
    }

    const data = await res.json();
    if (!data.features || data.features.length === 0) return null;

    const summary = data.features[0].properties;
    const distMeters = Math.round(summary.totalDistance);
    const durationSec = Math.round(summary.totalTime);

    const coordinates = [];
    const steps = [];

    data.features.forEach((f, idx) => {
      if (f.geometry.type === 'LineString') {
        f.geometry.coordinates.forEach((c) => {
          coordinates.push({ lat: c[1], lng: c[0] });
        });
      } else if (f.geometry.type === 'Point') {
        const p = f.properties;
        const nextFeature = data.features[idx + 1];
        const segDist = (nextFeature && nextFeature.geometry.type === 'LineString')
          ? Math.round(nextFeature.properties.distance || 0)
          : 0;

        steps.push({
          stepIndex: steps.length + 1,
          icon: parseTmapTurnIcon(p.turnType, p.pointType),
          instruction: p.description || '',
          distanceMeters: segDist,
          location: { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] },
        });
      }
    });

    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    const walkingTimeText = mins === 0 ? `약 ${Math.max(secs, 10)}초` : `약 ${mins}분 ${secs > 0 ? secs + '초' : ''}`;

    return {
      success: true,
      isRealRoad: true,
      source: 'TMAP',
      distanceMeters: distMeters,
      durationSeconds: durationSec,
      walkingTimeText,
      coordinates,
      steps,
    };
  } catch (err) {
    console.warn('Tmap fetch error:', err.message);
    return null;
  }
}

module.exports = {
  getTmapApiKey,
  parseTmapTurnIcon,
  fetchTmapPedestrianRoute,
};
