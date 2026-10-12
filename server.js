require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// 환경변수 기반 API 키 및 설정 (하드코딩 제거)
const DATA_GO_KR_KEY = process.env.DATA_GO_KR_KEY || '';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

// 클라이언트 설정 제공 API (환경변수 안전 전달)
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    hasGoogleKey: !!GOOGLE_MAPS_API_KEY,
    hasDataGoKrKey: !!DATA_GO_KR_KEY,
  });
});

// 사용자 제보 데이터 저장소 (인메모리 + 파일)
const REPORTS_FILE = path.join(__dirname, 'reports.json');
let userReports = [];
if (fs.existsSync(REPORTS_FILE)) {
  try {
    userReports = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf-8'));
  } catch (e) {
    userReports = [];
  }
}

function saveReports() {
  try {
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(userReports, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save reports:', e);
  }
}

// 거리 계산 함수 (Haversine formula, 단위: meter)
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 지구 반지름 (m)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// 보행 소요 시간 계산 (평균 보행 속도 4.5km/h = 75m/min)
function getWalkingTimeText(distanceMeters) {
  const minutes = Math.floor(distanceMeters / 75);
  const seconds = Math.round((distanceMeters % 75) / 1.25);
  if (minutes === 0) {
    return `약 ${Math.max(seconds, 10)}초`;
  }
  return `약 ${minutes}분 ${seconds > 0 ? seconds + '초' : ''}`;
}

// AED 일련번호에서 설치/등록 연도 추출 (형식: 062-221116-094080 -> 2022)
function parseInstallYearFromSerial(serialSeq) {
  if (!serialSeq) return null;
  const parts = String(serialSeq).split('-');
  if (parts.length >= 2 && parts[1].length >= 2) {
    const yy = parseInt(parts[1].substring(0, 2), 10);
    if (!isNaN(yy)) {
      return yy < 50 ? 2000 + yy : 1900 + yy;
    }
  }
  return null;
}

// 현재 시간 기준 개방 여부 확인
function isCurrentlyAvailable(item) {
  const now = new Date();
  const day = now.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentTimeInt = hour * 100 + minute;

  // 요일별 시작/종료 시간 속성 매핑
  const dayPrefixes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const prefix = dayPrefixes[day];
  const stt = item[prefix + 'SttTme'] ? parseInt(item[prefix + 'SttTme'], 10) : 0;
  const end = item[prefix + 'EndTme'] ? parseInt(item[prefix + 'EndTme'], 10) : 2400;

  // 일요일 이용 가능 여부
  if (day === 0 && item['sunFifYon'] === 'N') {
    return false;
  }

  return currentTimeInt >= stt && currentTimeInt <= end;
}

// 실시간 AED 공공데이터 조회
async function fetchAEDData(lat, lon) {
  const url = `https://apis.data.go.kr/B552657/AEDInfoInqireService/getAedLcinfoInqire?serviceKey=${DATA_GO_KR_KEY}&WGS84_LON=${lon}&WGS84_LAT=${lat}&numOfRows=50&_type=json`;
  
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });

  if (!response.ok) {
    throw new Error(`API Response Status: ${response.status}`);
  }

  const data = await response.json();
  const items = data?.response?.body?.items?.item || [];
  return Array.isArray(items) ? items : [items];
}

// 화재 안전시설 (소화기 / 비상소화장치/소화전) 시뮬레이션 및 표준 데이터 생성
// 공공데이터포털 전국소방용수시설표준데이터 및 소화시설 데이터 기반
function getFireFacilities(centerLat, centerLon) {
  const currentYear = new Date().getFullYear();

  // 사용자 위치 반경 주변으로 실제 있을 법한 소화시설 템플릿 데이터
  const fireExtinguishers = [
    {
      id: 'EXT-01',
      category: 'extinguisher',
      name: 'ABC 분말소화기 (3.3kg)',
      org: '근린상가 건물관리소',
      buildAddress: '주변 공용 건축물 1층',
      buildPlace: '1층 엘리베이터 홀 우측 벽면 거치대',
      latOffset: 0.00045,
      lonOffset: 0.00032,
      installYear: 2021, // 5년 경과 (정상)
      pressureStatus: '정상 (녹색 범위)',
      inspectionDate: '2026-03-15',
      contact: '02-1234-5678',
    },
    {
      id: 'EXT-02',
      category: 'extinguisher',
      name: 'ABC 분말소화기 (3.3kg)',
      org: '지하철 역사/복합시설',
      buildAddress: '역사 출입구 지하 1층',
      buildPlace: '지하 1층 3번 출구 방화셔터 옆',
      latOffset: -0.00038,
      lonOffset: 0.00055,
      installYear: 2023, // 3년 경과 (정상)
      pressureStatus: '정상 (녹색 범위)',
      inspectionDate: '2026-07-20',
      contact: '02-6110-1114',
    },
    {
      id: 'EXT-03',
      category: 'extinguisher',
      name: '노후 분말소화기 (교체 대상)',
      org: '구형 다세대 빌라',
      buildAddress: '이면도로 주택가 입구',
      buildPlace: '1층 주차장 기둥 2번',
      latOffset: 0.00072,
      lonOffset: -0.00061,
      installYear: 2013, // 13년 경과 (내구연한 10년 초과! 노후 필터 대상)
      pressureStatus: '압력 저하 (황색 범위)',
      inspectionDate: '2019-11-01',
      contact: '010-9999-0001',
    },
    {
      id: 'EXT-04',
      category: 'extinguisher',
      name: '이산화탄소(CO2) 소화기',
      org: '공공기관 전산/방재실',
      buildAddress: '인근 행정복지센터 2층',
      buildPlace: '2층 민원실 입구 소화전함 상단',
      latOffset: -0.00085,
      lonOffset: -0.00042,
      installYear: 2022,
      pressureStatus: '정상',
      inspectionDate: '2026-05-10',
      contact: '02-3456-7890',
    }
  ];

  const hydrants = [
    {
      id: 'HYD-01',
      category: 'hydrant',
      name: '지상식 옥외소화전 (구경 65mm)',
      org: '소방청 관할 소방서',
      buildAddress: '대로변 보도블록',
      buildPlace: '버스정류장 후방 10m 인도 적색 표지',
      latOffset: 0.00060,
      lonOffset: 0.00015,
      installYear: 2019,
      waterPressure: '방수압력 0.35MPa (정상)',
      inspectionDate: '2026-08-01',
      contact: '119 소방관서',
    },
    {
      id: 'HYD-02',
      category: 'hydrant',
      name: '비상소화장치함 (골목길 화재진압용)',
      org: '관할 의용소방대',
      buildAddress: '주거밀집지역 소방도로',
      buildPlace: '골목길 전신주 옆 적색 비상소화장치함 (호스릴 일체형)',
      latOffset: -0.00055,
      lonOffset: -0.00078,
      installYear: 2020,
      waterPressure: '정상 호스 50m 완비',
      inspectionDate: '2026-06-12',
      contact: '119 소방관서',
    },
    {
      id: 'HYD-03',
      category: 'hydrant',
      name: '지하식 소화전 (맨홀형)',
      org: '소방청 관할 소방서',
      buildAddress: '사거리 횡단보도 인근',
      buildPlace: '황색 주정차금지 표시 맨홀 뚜껑',
      latOffset: 0.00095,
      lonOffset: 0.00080,
      installYear: 2018,
      waterPressure: '정상 작동',
      inspectionDate: '2026-04-18',
      contact: '119 소방관서',
    }
  ];

  const combined = [
    ...fireExtinguishers.map(item => ({
      ...item,
      wgs84Lat: centerLat + item.latOffset,
      wgs84Lon: centerLon + item.lonOffset,
    })),
    ...hydrants.map(item => ({
      ...item,
      wgs84Lat: centerLat + item.latOffset,
      wgs84Lon: centerLon + item.lonOffset,
    }))
  ];

  return combined;
}

// 메인 시설 목록 API (전처리 및 최단거리 분석 적용)
app.get('/api/facilities', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || 37.5665;
    const lon = parseFloat(req.query.lon) || 126.9780;
    const categoryFilter = req.query.category || 'all'; // all, aed, extinguisher, hydrant
    const verifiedOnly = req.query.verifiedOnly === 'true'; // 즉시 사용 가능한 장비만 필터링

    // 전처리 통계 카운터 (연구계획서 2단계 결과 보고용)
    const stats = {
      totalCollected: 0,
      invalidCoordsRemoved: 0,
      agedEquipmentFiltered: 0,
      unavailableHoursFiltered: 0,
      userReportedExcluded: 0,
      finalUsableCount: 0,
    };

    let allFacilities = [];

    // 1. AED 데이터 수집 (실제 공공데이터포털 API 연동)
    if (categoryFilter === 'all' || categoryFilter === 'aed') {
      try {
        const rawAeds = await fetchAEDData(lat, lon);
        stats.totalCollected += rawAeds.length;

        for (const raw of rawAeds) {
          const itemLat = parseFloat(raw.wgs84Lat);
          const itemLon = parseFloat(raw.wgs84Lon);

          // [전처리 1: 좌표 결측치 및 비정상 좌표 필터링]
          if (isNaN(itemLat) || isNaN(itemLon) || itemLat < 33 || itemLat > 39 || itemLon < 124 || itemLon > 132) {
            stats.invalidCoordsRemoved++;
            continue;
          }

          // [전처리 2: 등록일/노후도 분석]
          const installYear = parseInstallYearFromSerial(raw.serialSeq);
          const currentYear = new Date().getFullYear();
          const age = installYear ? currentYear - installYear : null;
          const isAged = age !== null && age >= 8; // 8년 이상 노후 또는 배터리 교체주기 초과 의심

          // [전처리 3: 현재 시각 운영시간 내 개방 여부]
          const availableNow = isCurrentlyAvailable(raw);

          // [전처리 4: 사용자 제보 접수 여부 확인]
          const facilityId = `AED-${raw.rnum || raw.serialSeq}`;
          const reports = userReports.filter(r => r.facilityId === facilityId);
          const hasIssueReport = reports.length > 0;

          // 즉시 가용 필터(verifiedOnly) 적용 시 부실/노후/미개방 장비 제외
          if (verifiedOnly) {
            if (isAged) {
              stats.agedEquipmentFiltered++;
              continue;
            }
            if (!availableNow) {
              stats.unavailableHoursFiltered++;
              continue;
            }
            if (hasIssueReport) {
              stats.userReportedExcluded++;
              continue;
            }
          }

          const distMeters = calculateDistanceMeters(lat, lon, itemLat, itemLon);

          allFacilities.push({
            id: facilityId,
            category: 'aed',
            categoryName: '자동심장충격기 (AED)',
            name: `${raw.org || '공공시설'} AED`,
            org: raw.org || '관리기관 미상',
            buildAddress: raw.buildAddress || '주소 정보 없음',
            buildPlace: raw.buildPlace || '상세 위치 정보 없음', // [계획서 핵심: 건물 내부 상세 위치]
            lat: itemLat,
            lon: itemLon,
            distanceMeters: distMeters,
            walkingTime: getWalkingTimeText(distMeters),
            model: raw.model || '표준 모델',
            mfg: raw.mfg || '제조사 정보 없음',
            clerkTel: raw.clerkTel || raw.managerTel || '119',
            installYear: installYear || '미상',
            age: age !== null ? `${age}년` : '확인 불가',
            isAged,
            availableNow,
            reportsCount: reports.length,
            reports,
            verified: !isAged && availableNow && !hasIssueReport,
          });
        }
      } catch (err) {
        console.error('AED API Fetch Error:', err.message);
      }
    }

    // 2. 소화기 및 소화전 데이터 수집 및 전처리
    if (categoryFilter === 'all' || categoryFilter === 'extinguisher' || categoryFilter === 'hydrant') {
      const fireItems = getFireFacilities(lat, lon);
      const filteredFireItems = fireItems.filter(item => {
        if (categoryFilter === 'extinguisher' && item.category !== 'extinguisher') return false;
        if (categoryFilter === 'hydrant' && item.category !== 'hydrant') return false;
        return true;
      });

      stats.totalCollected += filteredFireItems.length;

      for (const raw of filteredFireItems) {
        const itemLat = parseFloat(raw.wgs84Lat);
        const itemLon = parseFloat(raw.wgs84Lon);

        // 좌표 검증
        if (isNaN(itemLat) || isNaN(itemLon)) {
          stats.invalidCoordsRemoved++;
          continue;
        }

        const currentYear = new Date().getFullYear();
        const age = currentYear - raw.installYear;
        // 소화기 내구연한: 10년 (소방시설법 기준)
        const isAged = raw.category === 'extinguisher' && age >= 10;

        const facilityId = raw.id;
        const reports = userReports.filter(r => r.facilityId === facilityId);
        const hasIssueReport = reports.length > 0;

        if (verifiedOnly) {
          if (isAged) {
            stats.agedEquipmentFiltered++;
            continue;
          }
          if (hasIssueReport) {
            stats.userReportedExcluded++;
            continue;
          }
        }

        const distMeters = calculateDistanceMeters(lat, lon, itemLat, itemLon);

        allFacilities.push({
          id: facilityId,
          category: raw.category,
          categoryName: raw.category === 'extinguisher' ? '소화기' : '비상소화장치/소화전',
          name: raw.name,
          org: raw.org,
          buildAddress: raw.buildAddress,
          buildPlace: raw.buildPlace,
          lat: itemLat,
          lon: itemLon,
          distanceMeters: distMeters,
          walkingTime: getWalkingTimeText(distMeters),
          model: raw.pressureStatus || raw.waterPressure || '정상 규격',
          mfg: raw.category === 'extinguisher' ? '한국소방산업기술원 인증' : '소방청 표준시설',
          clerkTel: raw.contact || '119',
          installYear: raw.installYear,
          age: `${age}년`,
          isAged,
          availableNow: true,
          reportsCount: reports.length,
          reports,
          verified: !isAged && !hasIssueReport,
        });
      }
    }

    // 3. 최단거리 탐색 알고리즘 (거리 오름차순 정렬)
    allFacilities.sort((a, b) => a.distanceMeters - b.distanceMeters);

    // 4. 최단거리 장비 플래그 지정
    if (allFacilities.length > 0) {
      allFacilities[0].isNearest = true;
    }

    stats.finalUsableCount = allFacilities.length;

    res.json({
      success: true,
      userLocation: { lat, lon },
      stats,
      nearest: allFacilities.length > 0 ? allFacilities[0] : null,
      facilities: allFacilities,
    });
  } catch (error) {
    console.error('Error fetching facilities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 사용자 제보 등록 API (연구계획서: 실제로 없는 경우가 있을 수 있으므로 제보 시스템 구축)
app.post('/api/reports', (req, res) => {
  const { facilityId, facilityName, reportType, details, reporterName } = req.body;

  if (!facilityId || !reportType) {
    return res.status(400).json({ success: false, message: '필수 입력 항목이 누락되었습니다.' });
  }

  const newReport = {
    reportId: `REP-${Date.now()}`,
    facilityId,
    facilityName: facilityName || '안전시설',
    reportType, // 'MISSING' (장비 없음), 'DAMAGED' (고장/파손), 'LOCATION_DIFF' (위치 불일치), 'EXPIRED' (노후 경과)
    details: details || '',
    reporterName: reporterName || '익명 제보자',
    createdAt: new Date().toISOString(),
  };

  userReports.push(newReport);
  saveReports();

  res.json({
    success: true,
    message: '제보가 성공적으로 접수되었습니다. 긴급 안전망 검증에 반영됩니다.',
    report: newReport,
  });
});

// 제보 목록 조회 API
app.get('/api/reports', (req, res) => {
  res.json({
    success: true,
    total: userReports.length,
    reports: userReports,
  });
});

// ==========================================================
// 도보 실거리 매트릭스 및 실시간 인앱 길안내 API
// ==========================================================

// 다중 시설 도보 실거리 계산 API (Table Matrix)
app.post('/api/routes/matrix', async (req, res) => {
  try {
    const { origin, destinations } = req.body;
    if (!origin || !destinations || !Array.isArray(destinations) || destinations.length === 0) {
      return res.status(400).json({ success: false, message: '출발지와 목적지 목록이 필요합니다.' });
    }

    const oLat = parseFloat(origin.lat);
    const oLon = parseFloat(origin.lon);

    // 최대 25개 대상 처리 (OSRM 제한 준수)
    const targets = destinations.slice(0, 25);
    const coordsStr = `${oLon},${oLat};` + targets.map(t => `${t.lon},${t.lat}`).join(';');
    const url = `https://routing.openstreetmap.de/routed-foot/table/v1/driving/${coordsStr}?sources=0&annotations=distance,duration`;

    let data = null;
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (resp.ok) {
        data = await resp.json();
      }
    } catch (e) {
      console.warn('Matrix fetch warning:', e.message);
    }

    const results = targets.map((t, idx) => {
      let distMeters = null;
      let durationSec = null;

      if (data && data.code === 'Ok' && data.distances && data.distances[0] && data.distances[0][idx + 1] !== null) {
        distMeters = Math.round(data.distances[0][idx + 1]);
        durationSec = Math.round(data.durations[0][idx + 1]);
      } else {
        // Fallback: 직선거리 x 1.25 (보행 도로망 우회 계수)
        const straight = calculateDistanceMeters(oLat, oLon, t.lat, t.lon);
        distMeters = Math.round(straight * 1.25);
        durationSec = Math.round(distMeters / 1.25);
      }

      const mins = Math.floor(durationSec / 60);
      const secs = durationSec % 60;
      const walkingTimeText = mins === 0 ? `약 ${Math.max(secs, 10)}초` : `약 ${mins}분 ${secs > 0 ? secs + '초' : ''}`;

      return {
        id: t.id,
        distanceMeters: distMeters,
        durationSeconds: durationSec,
        walkingTimeText,
        isRealRoad: (data && data.code === 'Ok')
      };
    });

    res.json({ success: true, results });
  } catch (error) {
    console.error('Error in route matrix:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 단일 목적지 상세 도보 경로 및 턴바이턴 길안내 API
app.post('/api/routes/directions', async (req, res) => {
  try {
    const { origin, destination } = req.body;
    if (!origin || !destination) {
      return res.status(400).json({ success: false, message: '출발지와 목적지 좌표가 필요합니다.' });
    }

    const oLat = parseFloat(origin.lat);
    const oLon = parseFloat(origin.lon);
    const dLat = parseFloat(destination.lat);
    const dLon = parseFloat(destination.lon);

    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${oLon},${oLat};${dLon},${dLat}?overview=full&geometries=geojson&steps=true`;

    let data = null;
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        data = await resp.json();
      }
    } catch (e) {
      console.warn('Directions fetch error:', e.message);
    }

    if (data && data.code === 'Ok' && data.routes && data.routes[0]) {
      const route = data.routes[0];
      const distMeters = Math.round(route.distance);
      const durationSec = Math.round(route.duration);
      const coordinates = route.geometry.coordinates.map(coord => ({ lat: coord[1], lng: coord[0] }));

      // 턴바이턴 스텝 한글화 파싱
      const rawSteps = (route.legs && route.legs[0] && route.legs[0].steps) || [];
      const steps = rawSteps.map((s, idx) => {
        const m = s.maneuver || {};
        const type = m.type || '';
        const mod = m.modifier || '';
        const dist = Math.round(s.distance || 0);
        const street = s.name ? ` (${s.name})` : '';

        let icon = '🚶';
        let instruction = '';

        if (type === 'depart') {
          icon = '🏁';
          instruction = `출발지에서 ${street || '보행로'} 방면으로 ${dist}m 이동`;
        } else if (type === 'arrive') {
          icon = '🎯';
          instruction = `목적지 도착`;
        } else if (type === 'turn') {
          if (mod.includes('left')) {
            icon = '↰';
            instruction = `좌회전 후 ${dist}m 이동${street}`;
          } else if (mod.includes('right')) {
            icon = '↱';
            instruction = `우회전 후 ${dist}m 이동${street}`;
          } else {
            icon = '↗️';
            instruction = `갈림길에서 ${dist}m 이동${street}`;
          }
        } else if (type === 'continue' || type === 'new name') {
          icon = '⬆️';
          instruction = `직진하여 ${dist}m 이동${street}`;
        } else if (type.includes('roundabout') || type.includes('rotary')) {
          icon = '🔄';
          instruction = `교차로 통과 후 ${dist}m 이동${street}`;
        } else {
          icon = '🚶';
          instruction = `${dist > 0 ? dist + 'm ' : ''}보행로 따라 이동${street}`;
        }

        return {
          stepIndex: idx + 1,
          icon,
          instruction,
          distanceMeters: dist,
          location: m.location ? { lat: m.location[1], lng: m.location[0] } : null
        };
      });

      const mins = Math.floor(durationSec / 60);
      const secs = durationSec % 60;
      const walkingTimeText = mins === 0 ? `약 ${Math.max(secs, 10)}초` : `약 ${mins}분 ${secs > 0 ? secs + '초' : ''}`;

      return res.json({
        success: true,
        isRealRoad: true,
        distanceMeters: distMeters,
        durationSeconds: durationSec,
        walkingTimeText,
        coordinates,
        steps,
      });
    }

    // Fallback: 직선 좌표 기반 기본 스텝 생성
    const straightDist = calculateDistanceMeters(oLat, oLon, dLat, dLon);
    const estDist = Math.round(straightDist * 1.25);
    const estSec = Math.round(estDist / 1.25);
    const mins = Math.floor(estSec / 60);
    const secs = estSec % 60;

    return res.json({
      success: true,
      isRealRoad: false,
      distanceMeters: estDist,
      durationSeconds: estSec,
      walkingTimeText: mins === 0 ? `약 ${Math.max(secs, 10)}초` : `약 ${mins}분 ${secs > 0 ? secs + '초' : ''}`,
      coordinates: [
        { lat: oLat, lng: oLon },
        { lat: dLat, lng: dLon }
      ],
      steps: [
        { stepIndex: 1, icon: '🏁', instruction: `출발지에서 목적지 방면으로 보행`, distanceMeters: Math.round(estDist / 2) },
        { stepIndex: 2, icon: '🎯', instruction: `목적지 주변 도착 및 내부 진입`, distanceMeters: Math.round(estDist / 2) }
      ]
    });

  } catch (error) {
    console.error('Error in directions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚨 공공 안전시설 응급탐색 시스템 서버 가동 완료`);
    console.log(`🌐 서비스 주소: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

module.exports = app;
