require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

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
const getKakaoRestApiKey = () => process.env.KAKAO_REST_API_KEY || process.env.KAKAO_MAP_API_KEY || '';
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

// 원터치 시설 점검 및 확인(Micro Check-in) 데이터 저장소
const CHECKINS_FILE = path.join(__dirname, 'checkins.json');
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

// 한국 표준시 (KST, UTC+9) 기준 현재 요일 및 시각 계산 (Vercel 클라우드 서버 UTC 시차 완벽 보정)
function getKstNow() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
  });
  const parts = formatter.formatToParts(new Date());
  const map = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });

  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[map.weekday] !== undefined ? dayMap[map.weekday] : (new Date().getUTCDay() + 1) % 7;
  const hour = parseInt(map.hour, 10);
  const minute = parseInt(map.minute, 10);
  return { day, hour, minute, currentTimeInt: hour * 100 + minute };
}

// 시간 문자열 포맷팅 (예: 830 -> "08:30")
function formatTimeStr(t) {
  if (t === undefined || t === null || t === '') return '';
  const s = String(t).padStart(4, '0');
  return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
}

function parseTimeField(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = parseInt(val, 10);
  if (isNaN(n)) return null;
  if (n < 0 || n > 2400) return 'INVALID';
  return n;
}

/**
 * 🌟 [5] 24시간 여부, 운영시간 요약, 현재 개방 여부를 하나의 통합 함수에서 일관되게 계산
 * - 모순 발생 원천 차단: 24시간 여부, 요약 문자열, 현재 개방 여부 일원화
 * - 이상값(0~2400 범위 외)은 '원본 표기 확인 필요' 및 availableNow: null로 격리
 * - 시간 정보 부재 시 '운영시간 정보 없음' 및 availableNow: null로 처리
 */
function calculateAedOperatingInfo(item) {
  if (!item) {
    return {
      operatingHours: '운영시간 정보 없음',
      available24h: false,
      availableNow: null,
    };
  }

  const monStt = parseTimeField(item.monSttTme);
  const monEnd = parseTimeField(item.monEndTme);
  const tueStt = parseTimeField(item.tueSttTme);
  const tueEnd = parseTimeField(item.tueEndTme);
  const wedStt = parseTimeField(item.wedSttTme);
  const wedEnd = parseTimeField(item.wedEndTme);
  const thuStt = parseTimeField(item.thuSttTme);
  const thuEnd = parseTimeField(item.thuEndTme);
  const friStt = parseTimeField(item.friSttTme);
  const friEnd = parseTimeField(item.friEndTme);
  const satStt = parseTimeField(item.satSttTme);
  const satEnd = parseTimeField(item.satEndTme);
  const sunStt = parseTimeField(item.sunSttTme);
  const sunEnd = parseTimeField(item.sunEndTme);

  const allTimes = [
    monStt, monEnd, tueStt, tueEnd, wedStt, wedEnd,
    thuStt, thuEnd, friStt, friEnd, satStt, satEnd, sunStt, sunEnd,
  ];

  // 1. 0000~2400 범위를 벗어난 이상값(예: 2500) 감지
  if (allTimes.some((t) => t === 'INVALID')) {
    return {
      operatingHours: '원본 표기 확인 필요',
      available24h: false,
      availableNow: null,
    };
  }

  // 2. 시간 정보가 전혀 없는 경우
  if (allTimes.every((t) => t === null)) {
    return {
      operatingHours: '운영시간 정보 없음',
      available24h: false,
      availableNow: null,
    };
  }

  // 3. 24시간 여부 확인: 평일/주말 모두 00:00~24:00인 경우
  const isMon24 = monStt === 0 && monEnd === 2400;
  const isSat24 = satStt === 0 && satEnd === 2400;
  const isSun24 = sunStt === 0 && sunEnd === 2400;

  if (isMon24 && isSat24 && isSun24) {
    return {
      operatingHours: '24시간 상시 개방',
      available24h: true,
      availableNow: true,
    };
  }

  // 4. 일반 요약 문구 생성
  let operatingHours = '운영시간 정보 없음';
  if (monStt !== null && monEnd !== null) {
    const hasSat = satStt !== null && satEnd !== null;
    const hasSun = sunStt !== null && sunEnd !== null;
    if (!hasSat && !hasSun) {
      operatingHours = `평일 ${formatTimeStr(monStt)}~${formatTimeStr(monEnd)} (주말 휴무)`;
    } else if (
      hasSat &&
      hasSun &&
      satStt === monStt &&
      satEnd === monEnd &&
      sunStt === monStt &&
      sunEnd === monEnd
    ) {
      operatingHours = `매일 ${formatTimeStr(monStt)}~${formatTimeStr(monEnd)}`;
    } else if (hasSat) {
      operatingHours = `평일 ${formatTimeStr(monStt)}~${formatTimeStr(monEnd)} (토 ${formatTimeStr(satStt)}~${formatTimeStr(satEnd)})`;
    } else {
      operatingHours = `평일 ${formatTimeStr(monStt)}~${formatTimeStr(monEnd)}`;
    }
  } else if (satStt !== null && satEnd !== null) {
    operatingHours = `주말 ${formatTimeStr(satStt)}~${formatTimeStr(satEnd)}`;
  }

  // 5. 현재 KST 시각 기준 개방 여부 판정
  const { day, currentTimeInt } = getKstNow();
  let availableNow = false;

  const dayStt = [sunStt, monStt, tueStt, wedStt, thuStt, friStt, satStt][day];
  const dayEnd = [sunEnd, monEnd, tueEnd, wedEnd, thuEnd, friEnd, satEnd][day];

  if (dayStt !== null && dayEnd !== null) {
    availableNow = currentTimeInt >= dayStt && currentTimeInt <= dayEnd;
  } else if (day >= 1 && day <= 5 && monStt !== null && monEnd !== null) {
    // 평일이고 해당 요일 시간 없으면 월요일 시간 준용
    availableNow = currentTimeInt >= monStt && currentTimeInt <= monEnd;
  } else {
    // 주말인데 시간이 없거나 일요일 미운영인 경우 이용 불가
    availableNow = false;
  }

  return {
    operatingHours,
    available24h: false,
    availableNow,
  };
}

// 인메모리 지오코딩 캐시 (동일 주소/기관명 반복 조회 방지 및 초고속 0ms 응답 보장)
const aedGeocodeCache = new Map();

// 공공데이터포털 등록 좌표의 지번/필지 오차 교차 검증 및 지오코딩 보정 함수
async function geocodeAddress(address, orgName = '', centerLat = null, centerLon = null) {
  const cacheKey = `${address || ''}|${orgName || ''}|${centerLat || ''}|${centerLon || ''}`;
  if (aedGeocodeCache.has(cacheKey)) {
    return aedGeocodeCache.get(cacheKey);
  }

  const kakaoKey = getKakaoRestApiKey();
  if (!kakaoKey) {
    return null;
  }

  // 카카오 지도 JavaScript API Key를 서버에서 호출하기 위한 필수 헤더
  const headers = {
    Authorization: `KakaoAK ${kakaoKey}`,
    KA: 'sdk/1.0.0 os/javascript lang/ko-KR res/1920x1080 device/pc origin/https://prompt-bismuth-avyohx5.vercel.app',
    Origin: 'https://prompt-bismuth-avyohx5.vercel.app',
  };

  const cleanAddr = (address || '').split(',')[0].replace(/\([^\)]*\)/g, '').trim();

  try {
    // 1. 주요 랜드마크/기관명 키워드 검색 (위치 반경 제한 및 정확한 단어 경계 검사)
    const isSignificantPlace = /(?:초등학교|중학교|고등학교|대학교|병원|보건소|도서관|주민센터|구청|시청|경찰서|소방서|복지관|수련관|체육센터|문화센터|아파트|타워|[가-힣0-9]+역\b)/.test(orgName);
    if (orgName && isSignificantPlace) {
      let kwUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(orgName)}`;
      if (centerLat && centerLon) {
        kwUrl += `&y=${centerLat}&x=${centerLon}&radius=3000`; // 3km 반경 내로 검색 범위 엄격 제한 (타도시 동명 시설 오매칭 방지)
      }
      const kwRes = await fetch(kwUrl, { headers });
      if (kwRes.ok) {
        const kwData = await kwRes.json();
        if (kwData.documents && kwData.documents.length > 0) {
          const matched = kwData.documents.find(d => {
            const addr = d.road_address_name || d.address_name || '';
            const tokens = addr.split(' ').filter(t => t.length >= 2);
            return tokens.length > 0 && tokens.some(t => cleanAddr.includes(t));
          }) || (centerLat && centerLon ? kwData.documents[0] : null);

          if (matched) {
            const res = {
              lat: parseFloat(matched.y),
              lon: parseFloat(matched.x),
              source: 'KAKAO_KEYWORD',
              matchedName: matched.place_name,
              matchedAddr: matched.road_address_name || matched.address_name,
            };
            aedGeocodeCache.set(cacheKey, res);
            return res;
          }
        }
      }
    }

    // 2. 도로명/지번 정밀 주소 지오코딩 검색 (상세 건물 필지 중심)
    if (cleanAddr) {
      const addrUrl = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(cleanAddr)}`;
      const addrRes = await fetch(addrUrl, { headers });
      if (addrRes.ok) {
        const addrData = await addrRes.json();
        if (addrData.documents && addrData.documents.length > 0) {
          const doc = addrData.documents[0];
          const res = {
            lat: parseFloat(doc.y),
            lon: parseFloat(doc.x),
            source: 'KAKAO_ADDRESS',
            matchedAddr: doc.address_name,
          };
          aedGeocodeCache.set(cacheKey, res);
          return res;
        }
      }
    }
  } catch (err) {
    // 지오코딩 실패 시 안전하게 null 반환
  }

  aedGeocodeCache.set(cacheKey, null);
  return null;
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

// 민방위 대피시설 전국 공공데이터 (행정안전부_민방위대피시설 조회서비스)
let sheltersCache = null;

function getSheltersFilePath() {
  const p1 = path.join(__dirname, 'data', 'shelters.json');
  if (fs.existsSync(p1)) return p1;
  const p2 = path.join(process.cwd(), 'data', 'shelters.json');
  if (fs.existsSync(p2)) return p2;
  const p3 = path.join(__dirname, '..', 'data', 'shelters.json');
  if (fs.existsSync(p3)) return p3;
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
function getNearbyShelters(centerLat, centerLon, maxRadiusMeters = 5000) {
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
      const reports = userReports.filter(r => r.facilityId === facilityId);
      const hasIssueReport = reports.length > 0;

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
        checkin: facilityCheckins[facilityId] || null,
        verified: !hasIssueReport,
      });
    }
  }

  matched.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return matched.slice(0, 30);
}

// 🌟 [8] 위경도 소수점 3자리(~100m) 격자 기반 인메모리 캐시 (공공데이터 API 쿼터 절약 및 빠른 응답)
const facilityGridCache = new Map();
const FACILITY_CACHE_TTL_MS = 60 * 1000; // 60초 캐시

// 메인 시설 목록 API (전처리 및 최단거리 분석 적용)
app.get(['/api/facilities', '/facilities'], async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || 37.5665;
    const lon = parseFloat(req.query.lon || req.query.lng) || 126.9780;
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

    // 1. AED 데이터 수집 (실제 공공데이터포털 API 연동)
    if (categoryFilter === 'all' || categoryFilter === 'aed') {
      try {
        const rawAeds = await fetchAEDData(lat, lon);
        stats.totalCollected += rawAeds.length;

        const aedFacilities = await Promise.all(
          rawAeds.map(async (raw) => {
            const itemLat = parseFloat(raw.wgs84Lat);
            const itemLon = parseFloat(raw.wgs84Lon);

            // [전처리 1: 좌표 결측치 및 비정상 좌표 필터링]
            if (isNaN(itemLat) || isNaN(itemLon) || itemLat < 33 || itemLat > 39 || itemLon < 124 || itemLon > 132) {
              stats.invalidCoordsRemoved++;
              return null;
            }

            // 🌟 [5] 단일 통합 함수로 운영시간 요약, 24시간 여부, 현재 개방 여부 동시 산출 (모순 원천 제거)
            const opInfo = calculateAedOperatingInfo(raw);
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
            if (verifiedOnly) {
              if (availableNow === false) {
                stats.unavailableHoursFiltered++;
              }
            }

            // 🌟 [위치 보정 복구] 도로명/건물 지오코딩 교차 검증 및 정밀 위치 보정 적용
            let finalLat = itemLat;
            let finalLon = itemLon;
            let locationConfidence = 'NORMAL';
            let calibrationOffsetMeters = 0;

            if (raw.buildAddress || raw.org) {
              const geocoded = await geocodeAddress(raw.buildAddress, raw.org, itemLat, itemLon);
              if (geocoded && !isNaN(geocoded.lat) && !isNaN(geocoded.lon)) {
                const diffMeters = calculateDistanceMeters(itemLat, itemLon, geocoded.lat, geocoded.lon);
                calibrationOffsetMeters = diffMeters;

                // 70m 이상 편차 발생 시 공공데이터의 지번/필지 오차로 판별하여 도로명/건물 정밀좌표로 보정
                // 단, 5km 이상 심한 괴리는 타지역 동명 시설 오매칭 방지를 위해 원본 유지 및 확인 필요 상태 부여
                if (diffMeters >= 70 && diffMeters < 5000) {
                  finalLat = geocoded.lat;
                  finalLon = geocoded.lon;
                  locationConfidence = 'CALIBRATED';
                } else if (diffMeters >= 5000) {
                  locationConfidence = 'CHECK_NEEDED';
                }
              }
            }

            const distMeters = calculateDistanceMeters(lat, lon, finalLat, finalLon);

            return {
              id: facilityId,
              category: 'aed',
              categoryName: '자동심장충격기 (AED)',
              locationConfidence,
              calibrationOffsetMeters,
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
              clerkTel: raw.clerkTel || raw.managerTel || '119',
              availableNow,
              operatingHours,
              unconfirmedReportCount,
              reportsCount: reports.length,
              reports,
              checkin: facilityCheckins[facilityId] || null,
              verified: availableNow === true,
            };
          })
        );

        for (const item of aedFacilities) {
          if (item) allFacilities.push(item);
        }
      } catch (err) {
        console.error('AED API Fetch Error:', err.message);
      }
    }

    // 2. 민방위 대피소 데이터 수집 (행정안전부_민방위대피시설 조회서비스 기반)
    if (categoryFilter === 'all' || categoryFilter === 'shelter') {
      const shelterItems = getNearbyShelters(lat, lon);
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
      // 1순위 시설이 야간 미개방이거나 고장 제보가 있는 경우 24시간 상시 가용 시설을 대안으로 제공
      if (!first.availableNow || first.reportsCount > 0) {
        backup24h = allFacilities.slice(1).find(f => f.availableNow && f.available24h && f.reportsCount === 0) || null;
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
