require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { calculateDistanceMeters, getWalkingTimeText } = require('./lib/geo');
const { calculateAedOperatingInfo, getKstNow } = require('./lib/operatingHours');
const { isKstHoliday } = require('./lib/holidays');
const { mapWithConcurrency } = require('./lib/utils');
const { isRegionalConflict } = require('./lib/address');
const { getRegionInfo, geocodeAddress, geocodeSubLocation } = require('./lib/kakao');
const { getNearbyShelters } = require('./lib/shelters');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 허용 도메인 설정 (Vercel 배포 도메인 및 로컬 개발 환경 포트 허용)
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (
    origin === 'https://prompt-bismuth-avyohx5.vercel.app' ||
    origin.endsWith('.vercel.app') ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    return true;
  }
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());

// 간단한 인메모리 Rate Limiter (IP당 분당 최대 120회 요청 제한으로 공공데이터 API 쿼터 보호)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 120;

app.use('/api', (req, res, next) => {
  const ip =
    (req.headers['x-forwarded-for'] && String(req.headers['x-forwarded-for']).split(',')[0].trim()) ||
    req.socket?.remoteAddress ||
    'unknown';
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  } else {
    entry.count++;
    if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
      return res.status(429).json({
        success: false,
        message: '요청 횟수 제한(분당 120회)을 초과했습니다. 잠시 후 다시 시도해주세요.',
      });
    }
  }

  if (rateLimitMap.size > 500) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }
  next();
});
const staticDir = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, 'public');

// 구버전 클라이언트 캐시로 인한 404 흰화면 방지 에셋 핸들러
app.get('/assets/:file', (req, res, next) => {
  const fileName = req.params.file;
  const filePath = path.join(staticDir, 'assets', fileName);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  // 요청된 구버전 해시 파일이 없을 경우 최신 index 번들로 폴백 제공
  const assetsDir = path.join(staticDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    if (fileName.endsWith('.js')) {
      const activeJs = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
      if (activeJs) {
        res.setHeader('Content-Type', 'application/javascript');
        return res.sendFile(path.join(assetsDir, activeJs));
      }
    } else if (fileName.endsWith('.css')) {
      const activeCss = files.find(f => f.startsWith('index-') && f.endsWith('.css'));
      if (activeCss) {
        res.setHeader('Content-Type', 'text/css');
        return res.sendFile(path.join(assetsDir, activeCss));
      }
    }
  }
  next();
});

// HTML 진입점: 모바일 브라우저 캐시 방지 헤더 강제 적용
app.get(['/', '/index.html'], (req, res, next) => {
  const indexPath = path.join(staticDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(indexPath);
  }
  next();
});

// PWA 서비스 워커 및 매니페스트 캐시 제어
app.get('/sw.js', (req, res, next) => {
  const swPath = path.join(staticDir, 'sw.js');
  if (fs.existsSync(swPath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    return res.sendFile(swPath);
  }
  next();
});

app.get(['/manifest.json', '/manifest.webmanifest'], (req, res, next) => {
  const mPath = path.join(staticDir, 'manifest.json');
  if (fs.existsSync(mPath)) {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.sendFile(mPath);
  }
  next();
});

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

// 사용자 제보·점검 데이터 저장 경로
// Vercel 서버리스는 배포 디렉터리가 읽기 전용이므로 임시 디렉터리에 기록 (인스턴스 재시작 시 초기화됨)
const DATA_WRITE_DIR = process.env.VERCEL ? require('os').tmpdir() : __dirname;

// 사용자 제보 데이터 저장소 (인메모리 + 파일)
// ※ 제보 기능은 정식 서비스 전이므로 시설 추천·필터 판단에는 반영하지 않음 (무인증 허위 제보로 정상 AED가 밀려나는 것 방지)
const REPORTS_FILE = path.join(DATA_WRITE_DIR, 'reports.json');
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

// 원터치 시설 점검 및 확인(Micro Check-in) 데이터 저장소
const CHECKINS_FILE = path.join(DATA_WRITE_DIR, 'checkins.json');
let facilityCheckins = {};
if (fs.existsSync(CHECKINS_FILE)) {
  try {
    facilityCheckins = JSON.parse(fs.readFileSync(CHECKINS_FILE, 'utf-8'));
  } catch (e) {
    facilityCheckins = {};
  }
}

function saveCheckins() {
  try {
    fs.writeFileSync(CHECKINS_FILE, JSON.stringify(facilityCheckins, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save checkins:', e);
  }
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

// 🌟 [8] 위경도 소수점 3자리(~100m) 격자 기반 인메모리 캐시 (공공데이터 API 쿼터 절약 및 빠른 응답)
const facilityGridCache = new Map();
const FACILITY_CACHE_TTL_MS = 60 * 1000; // 60초 캐시

// 메인 시설 목록 API (전처리 및 최단거리 분석 적용)
app.get(['/api/facilities', '/facilities'], async (req, res) => {
  try {
    // 임의 기본 좌표(서울시청)로 대체하지 않고, 위치가 없으면 요청을 거부
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon || req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 33 || lat > 39 || lon < 124 || lon > 132) {
      return res.status(400).json({ success: false, message: '유효한 위치(lat, lon)가 필요합니다.' });
    }
    const categoryFilter = req.query.category || 'all'; // all, aed, extinguisher, hydrant
    const verifiedOnly = req.query.verifiedOnly === 'true'; // 즉시 사용 가능한 장비만 필터링

    // 🌟 [8] 위경도 ~100m 격자 캐시 확인 (캐시 적중 시 사용자 현재 좌표 기준 거리만 재계산)
    const gridKey = `${lat.toFixed(3)}_${lon.toFixed(3)}_${categoryFilter}_${verifiedOnly}`;
    const cachedEntry = facilityGridCache.get(gridKey);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < FACILITY_CACHE_TTL_MS) {
      const adjustedFacilities = cachedEntry.facilities
        .map((f) => {
          const dist = calculateDistanceMeters(lat, lon, f.lat, f.lon);
          return {
            ...f,
            isNearest: false,
            distanceMeters: dist,
            walkingTime: getWalkingTimeText(dist),
          };
        })
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      if (adjustedFacilities.length > 0) {
        adjustedFacilities[0].isNearest = true;
      }

      return res.json({
        success: true,
        userLocation: { lat, lon },
        stats: cachedEntry.stats,
        nearest: adjustedFacilities.length > 0 ? adjustedFacilities[0] : null,
        backup24h: cachedEntry.backup24h,
        facilities: adjustedFacilities,
        cached: true,
      });
    }

    // 전처리 통계 카운터
    const stats = {
      totalCollected: 0,
      invalidCoordsRemoved: 0,
      agedEquipmentFiltered: 0,
      unavailableHoursFiltered: 0,
      userReportedExcluded: 0,
      finalUsableCount: 0,
    };

    let allFacilities = [];

    // 사용자 현재/검색 위치 기준 광역 행정구역 정보 (시·도 / 시·군·구) 조회
    const centerRegion = await getRegionInfo(lat, lon);

    // 운영시간 판정 기준 시각 (KST) 및 공휴일 여부
    const kstNow = getKstNow();
    kstNow.isHoliday = await isKstHoliday(kstNow.dateKey);

    // 1. AED 데이터 수집 (실제 공공데이터포털 API 연동)
    if (categoryFilter === 'all' || categoryFilter === 'aed') {
      try {
        const rawAeds = await fetchAEDData(lat, lon);
        stats.totalCollected += rawAeds.length;

        // 시설당 카카오 API를 여러 번 호출하므로 동시 처리 수를 제한
        const aedFacilities = await mapWithConcurrency(rawAeds, 8, async (raw) => {
            const itemLat = parseFloat(raw.wgs84Lat);
            const itemLon = parseFloat(raw.wgs84Lon);

            // [전처리 1: 좌표 결측치 및 비정상 좌표 필터링]
            if (isNaN(itemLat) || isNaN(itemLon) || itemLat < 33 || itemLat > 39 || itemLon < 124 || itemLon > 132) {
              stats.invalidCoordsRemoved++;
              return null;
            }

            // 🌟 [행정구역 광역 교차 검증]
            // 주소의 시·도가 검색 위치와 다르면 원천 좌표 오염 의심 (예: 경기도 여주시 시설이 서울 마포구 양화로로 등록됨)
            // 단, 시·도 경계 인근(대전-세종, 부산-양산 등)의 정상 시설일 수 있으므로 바로 제외하지 않고
            // 아래에서 텍스트 주소 지오코딩으로 실제 위치를 검증한 뒤 반경 필터로 판단
            const regionConflict = !!(centerRegion && isRegionalConflict(raw.buildAddress, centerRegion.sido, centerRegion.sigungu));

            // 🌟 [5] 단일 통합 함수로 운영시간 요약, 24시간 여부, 현재 개방 여부 동시 산출 (모순 원천 제거)
            const opInfo = calculateAedOperatingInfo(raw, kstNow);
            const availableNow = opInfo.availableNow;
            const available24h = opInfo.available24h;
            const operatingHours = opInfo.operatingHours;

            // 🌟 [4] rnum(조회 순번) 대신 공공데이터 고유 식별자(serialSeq) 사용, 부재 시 결정론적 해시 (위치 변경에도 불변 고유 ID)
            const stableSeq = raw.serialSeq && String(raw.serialSeq).trim();
            const fallbackHash = !stableSeq
              ? require('crypto')
                  .createHash('md5')
                  .update(`${raw.org || ''}|${raw.buildAddress || ''}|${raw.buildPlace || ''}|${itemLat}|${itemLon}`)
                  .digest('hex')
                  .slice(0, 10)
              : null;
            const facilityId = stableSeq ? `AED-${stableSeq}` : `AED-H${fallbackHash}`;
            const reports = userReports.filter(r => r.facilityId === facilityId);
            const unconfirmedReportCount = reports.length;

            // 즉시 가용 필터(verifiedOnly) 적용 시:
            // 🌟 [8-1] 비공식적/근거없는 '노후' 판정 제거 - 가용 상태(availableNow)만 고려
            if (verifiedOnly && availableNow === false) {
              stats.unavailableHoursFiltered++;
              return null;
            }

            // 🌟 [정밀 위치 보정] 1단계: 상세위치(관리사무소, ○○동, 별관 등) 안전 보정 시도
            let finalLat = itemLat;
            let finalLon = itemLon;
            let locationConfidence = 'NORMAL';
            let calibrationOffsetMeters = 0;
            let matchedPlaceName = null;
            let calibrationType = null;

            // 원천 좌표 오염이 의심되는 시설은 원본 좌표 주변 세부위치 보정을 건너뜀
            let subGeocoded = null;
            if (!regionConflict && raw.org && raw.buildPlace) {
              subGeocoded = await geocodeSubLocation(raw.org, raw.buildPlace, itemLat, itemLon);
            }

            if (subGeocoded && !isNaN(subGeocoded.lat) && !isNaN(subGeocoded.lon)) {
              finalLat = subGeocoded.lat;
              finalLon = subGeocoded.lon;
              locationConfidence = 'CALIBRATED';
              matchedPlaceName = subGeocoded.matchedName;
              calibrationType = 'SUB_LOCATION';
              calibrationOffsetMeters = calculateDistanceMeters(itemLat, itemLon, finalLat, finalLon);
            } else if (raw.buildAddress || raw.org) {
              // 2단계: 일반 도로명/건물 지오코딩 보정
              // 오염 의심 시설은 원본 좌표 주변 키워드 검색 없이 텍스트 주소만으로 검증
              const geocoded = await geocodeAddress(raw.buildAddress, regionConflict ? '' : raw.org, itemLat, itemLon);
              if (geocoded && !isNaN(geocoded.lat) && !isNaN(geocoded.lon)) {
                const diffMeters = calculateDistanceMeters(itemLat, itemLon, geocoded.lat, geocoded.lon);
                calibrationOffsetMeters = diffMeters;

                // 70m 이상 편차 시 지번/필지 오차로 판별하여 건물 좌표로 보정
                // (건물 단위로 정확히 일치한 결과만 사용: 도로·읍면동 중심점으로 원본 좌표를 덮어쓰지 않음)
                if (diffMeters >= 70 && diffMeters < 5000 && geocoded.precision === 'EXACT') {
                  finalLat = geocoded.lat;
                  finalLon = geocoded.lon;
                  locationConfidence = 'CALIBRATED';
                  matchedPlaceName = geocoded.matchedName || geocoded.matchedAddr;
                  calibrationType = 'BUILDING';
                } else if (diffMeters >= 5000) {
                  // 🌟 공공데이터 원천 데이터의 좌표 오기재/오염 복원:
                  // 텍스트 주소 지오코딩 결과로 좌표를 복원하고, 이후 반경 검증에서 정상 필터링되도록 처리
                  // 건물 단위가 아닌 도로·읍면동 단위 복원은 근사 위치이므로 '위치 확인 필요'로 표시
                  finalLat = geocoded.lat;
                  finalLon = geocoded.lon;
                  locationConfidence = geocoded.precision === 'EXACT' ? 'CALIBRATED' : 'CHECK_NEEDED';
                  matchedPlaceName = geocoded.matchedName || geocoded.matchedAddr;
                  calibrationType = 'OUTLIER_RESTORED';
                }
              } else if (regionConflict) {
                // 오염 의심인데 주소로 실제 위치를 검증할 수 없으면 제외
                stats.invalidCoordsRemoved++;
                return null;
              }
            } else if (regionConflict) {
              stats.invalidCoordsRemoved++;
              return null;
            }

            const distMeters = calculateDistanceMeters(lat, lon, finalLat, finalLon);

            // 🌟 [유효 반경 필터] AED 응급 탐색 반경(최대 5,000m = 5km) 초과 시설 배제
            // (타지역에서 공공데이터 원천 오염으로 좌표가 튀어 딸려온 시설 및 원거리 시설 원천 차단)
            const MAX_AED_RADIUS_METERS = 5000;
            if (distMeters > MAX_AED_RADIUS_METERS) {
              stats.invalidCoordsRemoved++;
              return null;
            }

            return {
              id: facilityId,
              category: 'aed',
              categoryName: '자동심장충격기 (AED)',
              locationConfidence,
              calibrationOffsetMeters,
              calibrationType,
              matchedPlaceName,
              rawLat: itemLat,
              rawLon: itemLon,
              available24h,
              name: `${raw.org || '공공시설'} AED`,
              org: raw.org || '관리기관 미상',
              buildAddress: raw.buildAddress || '주소 정보 없음',
              buildPlace: raw.buildPlace || '상세 위치 정보 없음', // [계획서 핵심: 건물 내부 상세 위치]
              lat: finalLat,
              lon: finalLon,
              distanceMeters: distMeters,
              walkingTime: getWalkingTimeText(distMeters),
              model: raw.model || '표준 모델',
              mfg: raw.mfg || '제조사 정보 없음',
              clerkTel: raw.clerkTel || raw.managerTel || null,
              availableNow,
              operatingHours,
              unconfirmedReportCount,
              reportsCount: reports.length,
              reports,
              checkin: facilityCheckins[facilityId] || null,
              verified: availableNow === true,
            };
        });

        for (const item of aedFacilities) {
          if (item) allFacilities.push(item);
        }
      } catch (err) {
        console.error('AED API Fetch Error:', err.message);
      }
    }

    // 2. 민방위 대피소 데이터 수집 (행정안전부_민방위대피시설 조회서비스 기반)
    if (categoryFilter === 'all' || categoryFilter === 'shelter') {
      const shelterItems = getNearbyShelters(lat, lon, 5000, { reports: userReports, checkins: facilityCheckins });
      stats.totalCollected += shelterItems.length;

      for (const item of shelterItems) {
        if (verifiedOnly && !item.verified) {
          stats.userReportedExcluded++;
          continue;
        }
        allFacilities.push(item);
      }
    }

    // 3. 최단거리 탐색 알고리즘 (거리 오름차순 정렬)
    allFacilities.sort((a, b) => a.distanceMeters - b.distanceMeters);

    // 4. 최단거리 시설 및 2순위 24시간 백업 대안 시설 탐색
    let backup24h = null;
    if (allFacilities.length > 0) {
      allFacilities[0].isNearest = true;

      const first = allFacilities[0];
      // 1순위 시설이 지금 이용 가능하지 않은 경우 24시간 상시 가용 시설을 대안으로 제공
      if (first.availableNow !== true) {
        backup24h = allFacilities.slice(1).find(f => f.availableNow === true && f.available24h) || null;
      }
    }

    stats.finalUsableCount = allFacilities.length;

    // 🌟 [8] 위경도 격자 캐시 저장 (메모리 누수 방지 위해 최대 200개 제한)
    facilityGridCache.set(gridKey, {
      timestamp: Date.now(),
      facilities: allFacilities,
      stats,
      backup24h,
    });
    if (facilityGridCache.size > 200) {
      const now = Date.now();
      for (const [k, v] of facilityGridCache.entries()) {
        if (now - v.timestamp > FACILITY_CACHE_TTL_MS) facilityGridCache.delete(k);
      }
    }

    res.json({
      success: true,
      userLocation: { lat, lon },
      stats,
      nearest: allFacilities.length > 0 ? allFacilities[0] : null,
      backup24h,
      facilities: allFacilities,
    });
  } catch (error) {
    console.error('Error fetching facilities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 원터치 시설 상태 확인 (Micro Check-in) API (공식 서비스 준비 중)
app.post(['/api/checkin', '/checkin'], (req, res) => {
  const { facilityId, status, note } = req.body;
  if (!facilityId || !status) {
    return res.status(400).json({ success: false, message: '시설 ID와 상태가 필요합니다.' });
  }

  const prev = facilityCheckins[facilityId] || { normalCount: 0, issueCount: 0 };
  const cleanNote = String(note || '').slice(0, 300); // 300자 입력 제한
  if (status === 'NORMAL') {
    prev.normalCount = (prev.normalCount || 0) + 1;
    prev.lastNormalAt = new Date().toISOString();
  } else {
    prev.issueCount = (prev.issueCount || 0) + 1;
    prev.lastIssueAt = new Date().toISOString();
    prev.lastIssueNote = cleanNote || '잠김 또는 고장 신고';
  }
  prev.lastStatus = status;
  prev.lastUpdated = new Date().toISOString();

  facilityCheckins[facilityId] = prev;
  saveCheckins();

  res.json({
    success: true,
    message: '현장 실사 점검 기록이 접수되었습니다. (공식 서비스 준비 중)',
    checkin: prev,
  });
});

app.get(['/api/checkins', '/checkins'], (req, res) => {
  res.json({
    success: true,
    checkins: facilityCheckins,
  });
});

// 사용자 제보 등록 API (공식 서비스 준비 중)
app.post(['/api/reports', '/api/report', '/reports', '/report'], (req, res) => {
  const { facilityId, facilityName } = req.body;
  const reportType = req.body.reportType || req.body.issueType || 'ISSUE';
  const details = String(req.body.details || req.body.description || '').slice(0, 300); // 300자 입력 제한

  if (!facilityId) {
    return res.status(400).json({ success: false, message: '필수 입력 항목(facilityId)이 누락되었습니다.' });
  }

  const newReport = {
    reportId: `REP-${Date.now()}`,
    facilityId,
    facilityName: facilityName || '안전시설',
    reportType, // 'MISSING' (장비 없음), 'DAMAGED' (고장/파손), 'LOCATION_DIFF' (위치 불일치), 'EXPIRED' (노후 경과)
    details: details || '',
    createdAt: new Date().toISOString(),
  };

  userReports.push(newReport);
  saveReports();

  res.json({
    success: true,
    message: '제보가 성공적으로 접수되었습니다. (공식 서비스 준비 중)',
    report: newReport,
  });
});

// 🌟 [4] 제보 목록 조회 API (제보자 이름 등 개인정보 완전 제외하여 PII 보호)
app.get(['/api/reports', '/reports'], (req, res) => {
  const sanitizedReports = userReports.map(r => ({
    reportId: r.reportId,
    facilityId: r.facilityId,
    facilityName: r.facilityName,
    reportType: r.reportType,
    details: r.details,
    createdAt: r.createdAt,
  }));

  res.json({
    success: true,
    total: sanitizedReports.length,
    reports: sanitizedReports,
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
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'GoldenTime-SafeMap/1.0 (Emergency SafeMap Service)' },
        signal: AbortSignal.timeout(4000),
      });
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
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'GoldenTime-SafeMap/1.0 (Emergency SafeMap Service)' },
        signal: AbortSignal.timeout(5000),
      });
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
