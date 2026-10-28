// 민방위 대피시설 데이터 로딩 및 반경 탐색
const fs = require('fs');
const path = require('path');
const { calculateDistanceMeters, getWalkingTimeText } = require('./geo');

// 민방위 대피시설 전국 공공데이터 (행정안전부_민방위대피시설 조회서비스)
let sheltersCache = null;

function getSheltersFilePath() {
  const p1 = path.join(__dirname, '..', 'data', 'shelters.json');
  if (fs.existsSync(p1)) return p1;
  const p2 = path.join(process.cwd(), 'data', 'shelters.json');
  if (fs.existsSync(p2)) return p2;
  return null;
}

function getShelters() {
  if (!sheltersCache) {
    try {
      const filePath = getSheltersFilePath();
      if (filePath && fs.existsSync(filePath)) {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        sheltersCache = raw.map(arr => ({
          id: arr[0],
          name: arr[1],
          buildAddress: arr[2],
          floorType: arr[3],
          capacity: arr[4],
          area: arr[5],
          lat: arr[6],
          lon: arr[7],
        }));
      } else {
        sheltersCache = [];
      }
    } catch (e) {
      console.error('Failed to load shelters.json:', e);
      sheltersCache = [];
    }
  }
  return sheltersCache;
}

// 사용자 위치 기준 반경 내 민방위 대피시설 탐색 (반경 5km 내 최대 30개소)
function getNearbyShelters(centerLat, centerLon, maxRadiusMeters = 5000, { reports: allReports = [], checkins = {} } = {}) {
  const shelters = getShelters();

  // 🌟 [6] 한국 위도(약 37도)에 맞춘 경도 폭 cos(lat) 정밀 보정 (동서쪽 시설 누락 방지)
  const degLat = maxRadiusMeters / 111000;
  const cosLat = Math.max(0.2, Math.cos((centerLat * Math.PI) / 180));
  const degLon = maxRadiusMeters / (111000 * cosLat);

  const minLat = centerLat - degLat;
  const maxLat = centerLat + degLat;
  const minLon = centerLon - degLon;
  const maxLon = centerLon + degLon;

  const candidates = shelters.filter(s =>
    s.lat >= minLat && s.lat <= maxLat && s.lon >= minLon && s.lon <= maxLon
  );

  const matched = [];
  for (const s of candidates) {
    const dist = calculateDistanceMeters(centerLat, centerLon, s.lat, s.lon);
    if (dist <= maxRadiusMeters) {
      const facilityId = s.id;
      const reports = allReports.filter(r => r.facilityId === facilityId);

      // 🌟 [6] 수용인원과 면적 중복 문제: 불확실한 수용인원 추정치 대신 행안부 등록 면적(㎡)을 우선 표시
      const areaText = s.area > 0 ? `대피 면적 ${s.area.toLocaleString()}㎡` : '면적 정보 미제공';

      matched.push({
        id: facilityId,
        category: 'shelter',
        categoryName: '민방위 대피소',
        // 🌟 [6] 아파트/지하주차장/종교시설 등 평시 개방 여부 불명확하므로 근거 없는 24시간 표기 제거
        available24h: false,
        availableNow: null,
        operatingHours: '개방 여부 정보 없음',
        name: s.name,
        org: '행정안전부 민방위',
        buildAddress: s.buildAddress,
        buildPlace: `${s.floorType}대피소 · ${areaText}`,
        lat: s.lat,
        lon: s.lon,
        distanceMeters: dist,
        walkingTime: getWalkingTimeText(dist),
        capacity: s.capacity,
        area: s.area,
        floorType: s.floorType,
        // 🌟 [6] 출처 불명 번호(1588-3650) 및 응급신고용 119 제거
        clerkTel: '관할 시·군·구 재난안전과 문의',
        reportsCount: reports.length,
        reports,
        checkin: checkins[facilityId] || null,
        verified: true,
      });
    }
  }

  matched.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return matched.slice(0, 30);
}

module.exports = { getShelters, getNearbyShelters };
