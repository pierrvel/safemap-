import { calculateDistanceMeters } from './mapIcons';

// 가까운 곳을 함께 찾을 반경 (전국 검색과 동시에 해서 '부산역'처럼 먼 곳도 놓치지 않는다)
const NEARBY_RADIUS_METERS = 20000;
// 이 거리 안에서 이름에 검색어가 들어간 곳은 먼 곳의 정확한 이름보다 먼저 보여준다
// (서현에서 '한양아파트' → 먼 '한양아파트'보다 바로 옆 '시범한양아파트')
const CLOSE_RADIUS_METERS = 5000;
const MAX_RESULTS = 5;

function keywordSearch(places, query, options) {
  return new Promise((resolve) => {
    places.keywordSearch(
      query,
      (data, status) => resolve(status === window.kakao.maps.services.Status.OK ? data : []),
      options
    );
  });
}

function addressSearch(geocoder, query) {
  return new Promise((resolve) => {
    geocoder.addressSearch(query, (data, status) =>
      resolve(status === window.kakao.maps.services.Status.OK ? data : [])
    );
  });
}

// 이름이 검색어와 얼마나 맞는지: 정확히 같음 > 검색어로 시작 > 검색어 포함 > 그 밖
const squash = (text) => (text || '').replace(/\s+/g, '').toLowerCase();
function matchScore(name, query) {
  const n = squash(name);
  const q = squash(query);
  if (n === q) return 3;
  if (n.startsWith(q)) return 2;
  if (n.includes(q)) return 1;
  return 0;
}

/**
 * 장소 이름·주소로 후보를 찾는다 (카카오 장소 검색 + 주소 검색)
 * - 기준 위치 주변 5km(가까운 순)·20km(정확도 순)와 전국을 동시에 찾고, 각 후보까지의 거리를 붙인다
 * - 정렬: 주소로 정확히 찾은 결과 > 5km 안에서 이름에 검색어가 들어간 곳(가까운 순)
 *         > 이름이 더 정확히 맞는 곳 > (같은 정도면) 가까운 곳
 */
export async function searchPlaces(query, bias) {
  const services = window.kakao?.maps?.services;
  const q = query.trim();
  if (!services || !q) return [];

  const places = new services.Places();
  const geocoder = new services.Geocoder();
  const hasBias = Number.isFinite(bias?.lat) && Number.isFinite(bias?.lon);
  const nearOptions = hasBias
    ? { location: new window.kakao.maps.LatLng(bias.lat, bias.lon), radius: NEARBY_RADIUS_METERS, size: 15 }
    : { size: 15 };

  // 정확도 순 검색은 15곳까지만 오므로, 흔한 이름(한양아파트 등)은 바로 옆 단지가 빠질 수 있어 가까운 순 검색을 따로 한다
  const closestOptions = hasBias
    ? {
        location: new window.kakao.maps.LatLng(bias.lat, bias.lon),
        radius: CLOSE_RADIUS_METERS,
        sort: window.kakao.maps.services.SortBy.DISTANCE,
        size: 15,
      }
    : null;

  const [closest, nearby, nationwide, addresses] = await Promise.all([
    hasBias ? keywordSearch(places, q, closestOptions) : Promise.resolve([]),
    hasBias ? keywordSearch(places, q, nearOptions) : Promise.resolve([]),
    keywordSearch(places, q, { size: 15 }),
    addressSearch(geocoder, q),
  ]);
  const seenIds = new Set();
  const keywordResults = [...closest, ...nearby, ...nationwide].filter((p) => !seenIds.has(p.id) && seenIds.add(p.id));

  const toResult = (id, name, address, lat, lon, kind) => {
    const distanceMeters = hasBias ? calculateDistanceMeters(bias.lat, bias.lon, lat, lon) : null;
    const match = matchScore(name, q);
    let score = match;
    if (kind === 'address') score = 5;
    else if (match > 0 && distanceMeters !== null && distanceMeters <= CLOSE_RADIUS_METERS) score = 4;
    // 가까운 후보끼리는 거리순이되, 이름이 정확히 맞으면 더 가깝게·중간에만 들어 있으면 더 멀게 친다
    // (서현에서 '서현역' → '커피빈 서현역점'보다 서현역, '한양아파트' → 바로 옆 '시범한양아파트')
    const weight = { 3: 0.5, 2: 1, 1: 3 }[match] ?? 1;
    const rankDistance = distanceMeters === null ? 0 : distanceMeters * (score === 4 ? weight : 1);
    return { id, name, address, lat, lon, kind, score, distanceMeters, rankDistance };
  };

  const results = [
    ...addresses.slice(0, 2).map((a) => {
      const road = a.road_address?.address_name || '';
      const jibun = a.address?.address_name || a.address_name;
      const building = a.road_address?.building_name || '';
      return toResult(
        `addr-${a.x},${a.y}`,
        building || road || jibun,
        building ? road : road ? jibun : '',
        parseFloat(a.y),
        parseFloat(a.x),
        'address'
      );
    }),
    ...keywordResults.map((p) =>
      toResult(p.id, p.place_name, p.road_address_name || p.address_name, parseFloat(p.y), parseFloat(p.x), 'place')
    ),
  ];

  // 정렬은 안정 정렬이라 같은 점수·거리 정보가 없으면 카카오의 정확도 순서를 그대로 따른다
  results.sort((a, b) => b.score - a.score || (hasBias ? a.rankDistance - b.rankDistance : 0));

  // 같은 자리(10m 이내) 중복 제거
  const unique = [];
  results.forEach((r) => {
    if (!unique.some((u) => calculateDistanceMeters(u.lat, u.lon, r.lat, r.lon) <= 10)) unique.push(r);
  });
  return unique.slice(0, MAX_RESULTS);
}
