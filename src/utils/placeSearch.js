import { calculateDistanceMeters } from './mapIcons';

// 가까운 곳을 함께 찾을 반경 (전국 검색과 동시에 해서 '부산역'처럼 먼 곳도 놓치지 않는다)
const NEARBY_RADIUS_METERS = 20000;
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
 * - 기준 위치 주변 20km와 전국을 동시에 찾고, 각 후보까지의 거리를 붙인다
 * - 주소로 정확히 찾은 결과 > 이름이 더 정확히 맞는 곳 > (같은 정도면) 가까운 곳 순
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

  const [nearby, nationwide, addresses] = await Promise.all([
    hasBias ? keywordSearch(places, q, nearOptions) : Promise.resolve([]),
    keywordSearch(places, q, { size: 15 }),
    addressSearch(geocoder, q),
  ]);
  const seenIds = new Set();
  const keywordResults = [...nearby, ...nationwide].filter((p) => !seenIds.has(p.id) && seenIds.add(p.id));

  const toResult = (id, name, address, lat, lon, kind) => ({
    id,
    name,
    address,
    lat,
    lon,
    kind,
    score: kind === 'address' ? 4 : matchScore(name, q),
    distanceMeters: hasBias ? calculateDistanceMeters(bias.lat, bias.lon, lat, lon) : null,
  });

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
  results.sort((a, b) => b.score - a.score || (hasBias ? a.distanceMeters - b.distanceMeters : 0));

  // 같은 자리(10m 이내) 중복 제거
  const unique = [];
  results.forEach((r) => {
    if (!unique.some((u) => calculateDistanceMeters(u.lat, u.lon, r.lat, r.lon) <= 10)) unique.push(r);
  });
  return unique.slice(0, MAX_RESULTS);
}
