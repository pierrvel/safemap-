// 인터넷 없이 저장해 둔 시·도 자료로 가까운 AED·대피소를 찾는다
import { calculateDistanceMeters } from './mapIcons';
import { getDirectionText } from './format';
import { calculateAedOperatingInfo, getKstNow } from './operatingHours';
import { loadPack, readMeta } from './offlineStore';

const SEARCH_RADIUS_METERS = 5000;
const LIMIT = { aed: 50, shelter: 30 };

function toAed(row, now) {
  const [id, lat, lon, buildPlace, org, buildAddress, hours] = row;
  const op = calculateAedOperatingInfo(hours, now);
  return {
    id,
    category: 'aed',
    lat,
    lon,
    buildPlace: buildPlace || '상세 위치 정보 없음',
    org: org || '관리기관 미상',
    name: `${org || '공공시설'} AED`,
    buildAddress,
    operatingHours: op.operatingHours,
    availableNow: op.availableNow,
    available24h: op.available24h,
  };
}

function toShelter(row) {
  const [id, name, buildAddress, floorType, capacity, area, lat, lon] = row;
  const areaText = area > 0 ? `대피 면적 ${Number(area).toLocaleString()}㎡` : '면적 정보 미제공';
  return {
    id,
    category: 'shelter',
    lat,
    lon,
    name,
    org: '행정안전부 민방위',
    buildAddress,
    buildPlace: `${floorType}대피소 · ${areaText}`,
    operatingHours: '개방 여부 정보 없음',
    availableNow: null,
    available24h: false,
    capacity,
    area,
    floorType,
  };
}

// 저장한 자료가 있는지 (오프라인 안내 문구용)
export function hasOfflineData(category) {
  return Object.values(readMeta()).some((m) => m.category === category);
}

export async function findOfflineFacilities(lat, lon, category) {
  const regions = Object.values(readMeta())
    .filter((m) => m.category === category)
    .map((m) => m.region);
  if (!regions.length) return null;

  // 반경 5km 상자로 먼저 거른 뒤 정확한 거리를 잰다 (수만 곳을 다 재지 않도록)
  const degLat = SEARCH_RADIUS_METERS / 111000;
  const degLon = SEARCH_RADIUS_METERS / (111000 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const latIdx = category === 'aed' ? 1 : 6;
  const lonIdx = category === 'aed' ? 2 : 7;
  const now = getKstNow();

  const found = [];
  for (const region of regions) {
    const pack = await loadPack(category, region);
    if (!pack?.rows) continue;
    for (const row of pack.rows) {
      const rLat = row[latIdx];
      const rLon = row[lonIdx];
      if (Math.abs(rLat - lat) > degLat || Math.abs(rLon - lon) > degLon) continue;
      const dist = calculateDistanceMeters(lat, lon, rLat, rLon);
      if (dist > SEARCH_RADIUS_METERS) continue;
      found.push({ row, dist });
    }
  }

  return found
    .sort((a, b) => a.dist - b.dist)
    .slice(0, LIMIT[category])
    .map(({ row, dist }) => ({
      ...(category === 'aed' ? toAed(row, now) : toShelter(row)),
      distanceMeters: dist,
      direction: getDirectionText(lat, lon, row[latIdx], row[lonIdx]),
      offlineSource: 'pack',
    }));
}
