// Tmap (SK Open API) 보행자 경로 안내 연동 모듈
// 국내 도로망·골목길·신호등 횡단보도·육교·지하보도 및 아파트/학교 통행로 반영
const { calculateDistanceMeters } = require('./geo');

const getTmapApiKey = () => process.env.TMAP_API_KEY || '';

// AED는 건물 안 좌표라, 그대로 길찾기하면 가장 가까운 뒷길에 붙어 건물을 빙 돌아간다.
// 티맵 장소 검색의 "입구 좌표"로 길을 찾고, 입구에서 AED까지는 건물 안 직선으로 잇는다.
const ENTRANCE_MAX_METERS = 80; // 입구가 이보다 멀면(아파트 정문 등) 다른 출입구일 수 있어 쓰지 않는다
const PLACE_MAX_METERS = 100; // 검색된 장소 중심이 AED에서 이 안이어야 같은 건물로 본다
const INDOOR_SPEED_MPS = 1.1;
const entranceCache = new Map();

function cleanPlaceKeyword(name) {
  return String(name || '')
    .replace(/\s*(AED|자동심장충격기|\(.*?\))\s*/gi, ' ')
    .trim();
}

const POI_TIMEOUT_MS = 3000;
const entranceInflight = new Map();

// 이름 후보(건물 이름·기관명·시설 이름) 순서대로 입구를 찾는다. 검색은 동시에 하고 앞 후보의 결과를 쓴다
// waitMs까지만 기다리고, 그보다 늦은 검색은 뒤에서 마저 끝내 다음 요청 때 쓴다 (서버에서 첫 검색은 1초 넘게 걸리기도 한다)
async function findTmapEntrance(lat, lon, names, waitMs = 1500) {
  const keywords = [...new Set((Array.isArray(names) ? names : [names]).map(cleanPlaceKeyword))]
    .filter((k) => k.length >= 2)
    .slice(0, 3);
  if (!getTmapApiKey() || !keywords.length) return null;
  const searches = keywords.map((k) => {
    const cacheKey = `${lat.toFixed(6)},${lon.toFixed(6)},${k}`;
    if (entranceCache.has(cacheKey)) return Promise.resolve(entranceCache.get(cacheKey));
    if (!entranceInflight.has(cacheKey)) {
      entranceInflight.set(
        cacheKey,
        searchEntrance(lat, lon, k).finally(() => entranceInflight.delete(cacheKey))
      );
    }
    return entranceInflight.get(cacheKey);
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), waitMs));
  const found = await Promise.race([Promise.all(searches), timeout]);
  return found === 'timeout' ? null : found.find(Boolean) || null;
}

async function searchEntrance(lat, lon, keyword) {
  const appKey = getTmapApiKey();
  const cacheKey = `${lat.toFixed(6)},${lon.toFixed(6)},${keyword}`;

  const params = new URLSearchParams({
    version: '1',
    searchKeyword: keyword,
    searchType: 'all',
    searchtypCd: 'R', // 거리순
    centerLat: String(lat),
    centerLon: String(lon),
    radius: '1',
    count: '5',
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
  });
  let entrance = null;
  try {
    const res = await fetch(`https://apis.openapi.sk.com/tmap/pois?${params}`, {
      headers: { appKey },
      signal: AbortSignal.timeout(POI_TIMEOUT_MS),
    });
    // 결과가 없으면 204(본문 없음)로 온다. 그 밖의 오류(요청 과다 등)는 저장하지 않고 다음에 다시 찾는다
    if (!res.ok) {
      console.warn('Tmap POI search status:', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return null;
    }
    const data = res.status !== 204 ? await res.json() : null;
    const pois = data?.searchPoiInfo?.pois?.poi || [];
    for (const p of pois) {
      const front = { lat: parseFloat(p.frontLat), lon: parseFloat(p.frontLon) };
      const center = { lat: parseFloat(p.noorLat), lon: parseFloat(p.noorLon) };
      if (![front.lat, front.lon, center.lat, center.lon].every(Number.isFinite)) continue;
      if (calculateDistanceMeters(lat, lon, center.lat, center.lon) > PLACE_MAX_METERS) continue;
      const indoor = calculateDistanceMeters(lat, lon, front.lat, front.lon);
      if (indoor <= ENTRANCE_MAX_METERS) entrance = { ...front, indoorMeters: Math.round(indoor) };
      break;
    }
  } catch (err) {
    console.warn('Tmap POI search error:', err.message);
    return null; // 일시 오류는 저장하지 않는다
  }
  entranceCache.set(cacheKey, entrance);
  return entrance;
}

/**
 * 시설까지 도보 경로: 건물 입구를 찾으면 입구까지 길찾기 + 건물 안 직선, 못 찾으면 시설 좌표로 바로 길찾기
 */
async function fetchTmapRouteToFacility(oLat, oLon, dest, startName, timeoutMs = 4500) {
  const dLat = parseFloat(dest.lat);
  const dLon = parseFloat(dest.lon);
  const started = Date.now();
  // 짧게 답해야 하는 후보 비교(1.3초)에서는 이미 찾아 둔 입구만 쓰고, 경로 미리보기에서는 1.5초까지 기다린다
  const entrance = await findTmapEntrance(dLat, dLon, dest.names || dest.name, timeoutMs >= 3000 ? 1500 : 50);
  const left = Math.max(500, timeoutMs - (Date.now() - started));

  const direct = fetchTmapPedestrianRoute(oLat, oLon, dLat, dLon, startName, dest.name, left);
  if (!entrance || entrance.indoorMeters < 5) return direct;

  // 아파트 단지처럼 입구를 거치는 쪽이 오히려 먼 곳도 있어, 두 경로 중 짧은 쪽을 쓴다
  const [directRoute, entranceRoute] = await Promise.all([
    direct,
    fetchTmapPedestrianRoute(oLat, oLon, entrance.lat, entrance.lon, startName, dest.name, left).then((route) => {
      if (!route || !route.success) return null;
      const durationSec = route.durationSeconds + Math.round(entrance.indoorMeters / INDOOR_SPEED_MPS);
      return {
        ...route,
        distanceMeters: route.distanceMeters + entrance.indoorMeters,
        durationSeconds: durationSec,
        walkingTimeText: formatWalkingTime(durationSec),
        coordinates: [...route.coordinates, { lat: dLat, lng: dLon }],
        viaEntrance: true,
      };
    }),
  ]);
  if (!entranceRoute) return directRoute;
  if (!directRoute || !directRoute.success) return entranceRoute;
  return entranceRoute.distanceMeters < directRoute.distanceMeters ? entranceRoute : directRoute;
}

function formatWalkingTime(durationSec) {
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  return mins === 0 ? `약 ${Math.max(secs, 10)}초` : `약 ${mins}분 ${secs > 0 ? secs + '초' : ''}`;
}

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
async function fetchTmapPedestrianRoute(oLat, oLon, dLat, dLon, startName = '출발지', endName = '목적지', timeoutMs = 4500) {
  const appKey = getTmapApiKey();
  if (!appKey) return null;

  // 거의 도착했으면 티맵이 좌표 오류(400)를 내므로 직선으로 답한다
  const straight = calculateDistanceMeters(oLat, oLon, dLat, dLon);
  if (straight < 15) {
    const durationSec = Math.max(5, Math.round(straight / 1.2));
    return {
      success: true,
      isRealRoad: true,
      source: 'NEARBY',
      distanceMeters: Math.round(straight),
      durationSeconds: durationSec,
      walkingTimeText: formatWalkingTime(durationSec),
      coordinates: [{ lat: oLat, lng: oLon }, { lat: dLat, lng: dLon }],
      steps: [],
    };
  }

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
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      console.warn('Tmap Pedestrian API returned status:', res.status, (await res.text().catch(() => '')).slice(0, 200));
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

    return {
      success: true,
      isRealRoad: true,
      source: 'TMAP',
      distanceMeters: distMeters,
      durationSeconds: durationSec,
      walkingTimeText: formatWalkingTime(durationSec),
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
  fetchTmapRouteToFacility,
  findTmapEntrance,
};
