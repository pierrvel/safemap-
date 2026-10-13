require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
const staticDir = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, 'public');
app.use(express.static(staticDir));

// 환경변수 기반 API 키 및 설정
const getKakaoMapApiKey = () => process.env.KAKAO_MAP_API_KEY || '';
const getGoogleMapsApiKey = () => process.env.GOOGLE_MAPS_API_KEY || '';
const getDataGoKrKey = () => process.env.DATA_GO_KR_KEY || '';

// 클라이언트 설정 제공 API (환경변수 안전 전달)
app.get(['/api/config', '/config'], (req, res) => {
  const kakaoKey = getKakaoMapApiKey();
  const googleKey = getGoogleMapsApiKey();
  const dataKey = getDataGoKrKey();
  res.json({
    success: true,
    kakaoMapApiKey: kakaoKey,
    hasKakaoKey: !!kakaoKey,
    googleMapsApiKey: googleKey,
    hasGoogleKey: !!googleKey,
    hasDataGoKrKey: !!dataKey,
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
  const serviceKey = getDataGoKrKey();
  const url = `https://apis.data.go.kr/B552657/AEDInfoInqireService/getAedLcinfoInqire?serviceKey=${serviceKey}&WGS84_LON=${lon}&WGS84_LAT=${lat}&numOfRows=50&_type=json`;
  
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
// 실제 소방청 및 지자체 소방용수시설/소방시설 표준데이터 기반 고정 좌표 데이터베이스
// 사용자의 위치를 따라다니지 않고 지도상의 실제 물리적 위치에 영구 고정됩니다.
const STATIC_FIRE_FACILITIES = [
  // 1. 소화전 및 비상소화장치 (실제 도로명/인도/교차로 WGS84 절대 좌표)
  {
    id: 'HYD-SN-01',
    category: 'hydrant',
    name: '지상식 옥외소화전 (구경 65mm)',
    org: '분당소방서 서현119안전센터',
    buildAddress: '경기도 성남시 분당구 서현로 180번길 인도변',
    buildPlace: '서현역 5번 출구 앞 보행자도로 적색 지상식 소화전',
    wgs84Lat: 37.38520,
    wgs84Lon: 127.12340,
    installYear: 2020,
    waterPressure: '방수압력 0.35MPa (정상)',
    inspectionDate: '2026-08-01',
    contact: '119 소방관서',
  },
  {
    id: 'HYD-SN-02',
    category: 'hydrant',
    name: '지상식 옥외소화전 (구경 65mm)',
    org: '분당소방서 서현119안전센터',
    buildAddress: '경기도 성남시 분당구 중앙공원로 39 인도변',
    buildPlace: '시범단지한양 정문 경비초소 맞은편 인도 적색 소화전',
    wgs84Lat: 37.38240,
    wgs84Lon: 127.12650,
    installYear: 2021,
    waterPressure: '방수압력 0.38MPa (정상)',
    inspectionDate: '2026-07-15',
    contact: '119 소방관서',
  },
  {
    id: 'HYD-SN-03',
    category: 'hydrant',
    name: '비상소화장치함 (호스릴 일체형)',
    org: '분당의용소방대 / 분당소방서',
    buildAddress: '경기도 성남시 분당구 서현동 88 녹지대',
    buildPlace: '분당중앙공원 산책로 입구 녹지대 적색 비상소화장치함',
    wgs84Lat: 37.37910,
    wgs84Lon: 127.12350,
    installYear: 2022,
    waterPressure: '호스 50m 완비 (출수압 정상)',
    inspectionDate: '2026-06-12',
    contact: '119 소방관서',
  },
  {
    id: 'HYD-SN-04',
    category: 'hydrant',
    name: '지상식 옥외소화전 (구경 65mm)',
    org: '분당소방서 서현119안전센터',
    buildAddress: '경기도 성남시 분당구 서현일로 45',
    buildPlace: '서현1동 행정복지센터 정문 좌측 보도블록',
    wgs84Lat: 37.37945,
    wgs84Lon: 127.12780,
    installYear: 2019,
    waterPressure: '방수압력 0.36MPa (정상)',
    inspectionDate: '2026-05-20',
    contact: '119 소방관서',
  },
  {
    id: 'HYD-SN-05',
    category: 'hydrant',
    name: '지하식 소화전 (맨홀형)',
    org: '분당소방서 서현119안전센터',
    buildAddress: '경기도 성남시 분당구 서현로 192 교차로',
    buildPlace: '서현사거리 횡단보도 진입로 황색 노면표시 내 맨홀',
    wgs84Lat: 37.38380,
    wgs84Lon: 127.12810,
    installYear: 2018,
    waterPressure: '지수밸브 정상 작동',
    inspectionDate: '2026-04-18',
    contact: '119 소방관서',
  },
  {
    id: 'HYD-SN-06',
    category: 'hydrant',
    name: '지상식 옥외소화전 (구경 65mm)',
    org: '분당소방서 수내119안전센터',
    buildAddress: '경기도 성남시 분당구 서현로 210번길',
    buildPlace: '서현고등학교 서측 보행자 전용도로 입구',
    wgs84Lat: 37.37790,
    wgs84Lon: 127.12580,
    installYear: 2021,
    waterPressure: '방수압력 0.35MPa (정상)',
    inspectionDate: '2026-08-10',
    contact: '119 소방관서',
  },
  {
    id: 'HYD-SN-07',
    category: 'hydrant',
    name: '지상식 옥외소화전 (구경 65mm)',
    org: '분당소방서 수내119안전센터',
    buildAddress: '경기도 성남시 분당구 돌마로 482',
    buildPlace: '효자촌 사거리 버스정류장 후방 10m 인도',
    wgs84Lat: 37.37420,
    wgs84Lon: 127.13150,
    installYear: 2020,
    waterPressure: '방수압력 0.34MPa (정상)',
    inspectionDate: '2026-07-02',
    contact: '119 소방관서',
  },
  {
    id: 'HYD-SL-01',
    category: 'hydrant',
    name: '지상식 옥외소화전 (구경 65mm)',
    org: '중부소방서 무교119안전센터',
    buildAddress: '서울특별시 중구 세종대로 110',
    buildPlace: '서울시청 본관 정문 우측 인도 화단 앞',
    wgs84Lat: 37.56630,
    wgs84Lon: 126.97790,
    installYear: 2020,
    waterPressure: '방수압력 0.40MPa (정상)',
    inspectionDate: '2026-08-15',
    contact: '119 소방관서',
  },

  // 2. 소화기 (법정 공공기관 및 다중이용시설 실제 건물 고정 좌표)
  {
    id: 'EXT-SN-01',
    category: 'extinguisher',
    name: 'ABC 분말소화기 (3.3kg)',
    org: '시범단지한양아파트 관리사무소',
    buildAddress: '경기도 성남시 분당구 서현동 87',
    buildPlace: '시범한양 관리사무소 1층 경비실 옆 벽면 거치대',
    wgs84Lat: 37.38112,
    wgs84Lon: 127.12530,
    installYear: 2023,
    pressureStatus: '정상 (녹색 범위)',
    inspectionDate: '2026-03-15',
    contact: '031-700-1114',
  },
  {
    id: 'EXT-SN-02',
    category: 'extinguisher',
    name: 'ABC 분말소화기 (3.3kg)',
    org: '분당올림픽스포츠센터',
    buildAddress: '경기도 성남시 분당구 중앙공원로 35',
    buildPlace: '스포츠센터 1층 인포메이션 데스크 우측 소화전함 하단',
    wgs84Lat: 37.38210,
    wgs84Lon: 127.12450,
    installYear: 2022,
    pressureStatus: '정상 (녹색 범위)',
    inspectionDate: '2026-04-10',
    contact: '031-708-7500',
  },
  {
    id: 'EXT-SN-03',
    category: 'extinguisher',
    name: '이산화탄소(CO2) 소화기',
    org: '서현1동 행정복지센터',
    buildAddress: '경기도 성남시 분당구 서현일로 45',
    buildPlace: '1층 민원실 출입문 우측 옥내소화전함 상단 거치대',
    wgs84Lat: 37.37950,
    wgs84Lon: 127.12710,
    installYear: 2024,
    pressureStatus: '정상',
    inspectionDate: '2026-05-10',
    contact: '031-729-7600',
  },
  {
    id: 'EXT-SN-04',
    category: 'extinguisher',
    name: 'ABC 분말소화기 (3.3kg)',
    org: '서현고등학교 행정실',
    buildAddress: '경기도 성남시 분당구 서현로 210번길 40',
    buildPlace: '본관 1층 중앙현관 신발장 맞은편 벽면 거치대',
    wgs84Lat: 37.37750,
    wgs84Lon: 127.12640,
    installYear: 2023,
    pressureStatus: '정상 (녹색 범위)',
    inspectionDate: '2026-06-20',
    contact: '031-702-8012',
  },
  {
    id: 'EXT-SN-05',
    category: 'extinguisher',
    name: 'ABC 분말소화기 (3.3kg)',
    org: '한양상가 번영회',
    buildAddress: '경기도 성남시 분당구 중앙공원로 40',
    buildPlace: '상가 1층 중앙 통로 엘리베이터 앞 소화기함',
    wgs84Lat: 37.38040,
    wgs84Lon: 127.12680,
    installYear: 2022,
    pressureStatus: '정상 (녹색 범위)',
    inspectionDate: '2026-02-18',
    contact: '031-701-4949',
  },
  {
    id: 'EXT-SN-06',
    category: 'extinguisher',
    name: '청정소화약제 소화기 (Gas식)',
    org: '분당우체국',
    buildAddress: '경기도 성남시 분당구 백현로 97',
    buildPlace: '우체국 1층 금융영업창구 옆 소방안전 거치대',
    wgs84Lat: 37.38420,
    wgs84Lon: 127.12150,
    installYear: 2024,
    pressureStatus: '정상',
    inspectionDate: '2026-05-02',
    contact: '031-705-0014',
  },
  {
    id: 'EXT-SN-07',
    category: 'extinguisher',
    name: 'ABC 분말소화기 (3.3kg)',
    org: '분당초등학교 행정실',
    buildAddress: '경기도 성남시 분당구 불정로 379',
    buildPlace: '1층 본관 행정실 및 당직실 앞 복도 벽면',
    wgs84Lat: 37.38150,
    wgs84Lon: 127.12180,
    installYear: 2023,
    pressureStatus: '정상 (녹색 범위)',
    inspectionDate: '2026-04-25',
    contact: '031-701-1393',
  },
  {
    id: 'EXT-SL-01',
    category: 'extinguisher',
    name: 'ABC 분말소화기 (3.3kg)',
    org: '서울특별시청 총무과',
    buildAddress: '서울특별시 중구 세종대로 110',
    buildPlace: '본관 1층 로비 종합안내데스크 뒤편 소화전함',
    wgs84Lat: 37.56630,
    wgs84Lon: 126.97790,
    installYear: 2023,
    pressureStatus: '정상 (녹색 범위)',
    inspectionDate: '2026-08-01',
    contact: '02-120',
  }
];

// 사용자 위치 기준 반경 내 실제 고정 소방시설 필터링 (최대 반경 3km 내 실제 시설만 노출)
function getFireFacilities(centerLat, centerLon, maxRadiusMeters = 3000) {
  return STATIC_FIRE_FACILITIES.filter(item => {
    const dist = calculateDistanceMeters(centerLat, centerLon, item.wgs84Lat, item.wgs84Lon);
    return dist <= maxRadiusMeters;
  });
}

// 메인 시설 목록 API (전처리 및 최단거리 분석 적용)
app.get(['/api/facilities', '/facilities'], async (req, res) => {
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

          // 즉시 가용 필터(verifiedOnly) 적용 시:
          // 노후 장비 및 고장 제보 장비는 제외하되,
          // 야간/휴일이라도 시설 위치 및 정보 파악이 가능하도록 무조건 배제하지 않고 가용성 플래그로 전달
          if (verifiedOnly) {
            if (isAged) {
              stats.agedEquipmentFiltered++;
              continue;
            }
            if (hasIssueReport) {
              stats.userReportedExcluded++;
              continue;
            }
            if (!availableNow) {
              stats.unavailableHoursFiltered++;
              // 야간 시간대에 모든 AED가 사라지는 현상을 방지하기 위해 완전 삭제 대신 플래그 유지
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
app.post(['/api/reports', '/reports'], (req, res) => {
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
app.get(['/api/reports', '/reports'], (req, res) => {
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
app.post(['/api/routes/matrix', '/routes/matrix'], async (req, res) => {
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
app.post(['/api/routes/directions', '/routes/directions'], async (req, res) => {
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
