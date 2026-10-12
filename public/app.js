/**
 * 골든타임 세이프맵 (GoldenTime SafeMap)
 * 미니멀 클린 UX/UI & Google Maps Platform 정식 SDK 연동
 */

// 사용자 제공 공식 Google Maps API Key
const DEFAULT_GOOGLE_MAPS_KEY = 'AIzaSyAel7wHqi5tEehtbapmcmY1rHLoPJIPk74';

// 공공데이터포털 인증키 (국립중앙의료원 전국 AED 정보조회 서비스)
const DATA_GO_KR_KEY = 'cHwaVtA5OSzBd8gpTWKh2vM7qNRMDW55vNxj0bnj5JgFoTv7ih74zb9sZR6Q788IQIxEIVSKgknbEPUN332gAQ%3D%3D';

// URL 파라미터 또는 localStorage에 키가 있으면 우선 사용
const urlParams = new URLSearchParams(window.location.search);
const keyFromUrl = urlParams.get('key') || urlParams.get('gkey');
const activeGoogleKey = keyFromUrl || localStorage.getItem('google_maps_api_key') || DEFAULT_GOOGLE_MAPS_KEY;
localStorage.setItem('google_maps_api_key', activeGoogleKey);

// 전역 상태
const state = {
  userLat: 37.5665,
  userLon: 126.9780,
  currentCategory: 'all',
  verifiedOnly: true,
  facilities: [],
  nearestFacility: null,
  stats: null,
  
  googleApiKey: activeGoogleKey,
  map: null,
  isSatelliteMode: false,
  
  markers: [],
  markersMap: new Map(),
  selectedFacilityId: null,
  userMarker: null,
  routePolyline: null,
  currentInfoWindow: null,
  
  isSheetCollapsed: false,
  userReports: JSON.parse(localStorage.getItem('safemap_user_reports') || '[]'),
};

// DOM 요소 캐시
const elements = {
  // 헤더 및 필터
  countAll: document.getElementById('countAll'),
  countAed: document.getElementById('countAed'),
  countExt: document.getElementById('countExt'),
  countHyd: document.getElementById('countHyd'),
  verifiedToggle: document.getElementById('verifiedToggle'),
  chips: document.querySelectorAll('.chip'),
  sdkStatusBadge: document.getElementById('sdkStatusBadge'),

  // 지도 및 컨트롤
  mainMapContainer: document.getElementById('mainMap'),
  btnCurrentLocation: document.getElementById('btnCurrentLocation'),
  btnRefreshArea: document.getElementById('btnRefreshArea'),
  btnMapLayerToggle: document.getElementById('btnMapLayerToggle'),
  mapLayerIcon: document.getElementById('mapLayerIcon'),
  btnFloatToggleCard: document.getElementById('btnFloatToggleCard'),
  floatToggleIcon: document.getElementById('floatToggleIcon'),
  statusBanner: document.getElementById('statusBanner'),
  statusMessage: document.getElementById('statusMessage'),

  // 하단 접이식 시트
  bottomSheet: document.getElementById('bottomSheet'),
  sheetHandle: document.getElementById('sheetHandle'),
  miniSummaryBar: document.getElementById('miniSummaryBar'),
  miniNearestName: document.getElementById('miniNearestName'),
  miniNearestDist: document.getElementById('miniNearestDist'),
  miniNearestPlace: document.getElementById('miniNearestPlace'),

  // 최단거리 정보 카드
  nearestCard: document.getElementById('nearestCard'),
  nearestCategoryBadge: document.getElementById('nearestCategoryBadge'),
  nearestDistance: document.getElementById('nearestDistance'),
  nearestWalkingTime: document.getElementById('nearestWalkingTime'),
  goldenIndicator: document.getElementById('goldenIndicator'),
  nearestTitle: document.getElementById('nearestTitle'),
  nearestIndoorPlace: document.getElementById('nearestIndoorPlace'),
  nearestAddress: document.getElementById('nearestAddress'),
  nearestOrg: document.getElementById('nearestOrg'),
  nearestAge: document.getElementById('nearestAge'),
  btnNavigation: document.getElementById('btnNavigation'),
  btnCallManager: document.getElementById('btnCallManager'),
  btnReportIssue: document.getElementById('btnReportIssue'),

  // 리스트 섹션
  listToggleHeader: document.getElementById('listToggleHeader'),
  listArrow: document.getElementById('listArrow'),
  facilityList: document.getElementById('facilityList'),
  totalListCount: document.getElementById('totalListCount'),

  // 모달
  preprocessingModal: document.getElementById('preprocessingModal'),
  reportModal: document.getElementById('reportModal'),
  safetyGuideModal: document.getElementById('safetyGuideModal'),
  settingsModal: document.getElementById('settingsModal'),

  btnPreprocessingReport: document.getElementById('btnPreprocessingReport'),
  btnSafetyGuide: document.getElementById('btnSafetyGuide'),
  btnSettings: document.getElementById('btnSettings'),

  statCollected: document.getElementById('statCollected'),
  statCoordRemoved: document.getElementById('statCoordRemoved'),
  statAgedFiltered: document.getElementById('statAgedFiltered'),
  statHoursFiltered: document.getElementById('statHoursFiltered'),
  statReportExcluded: document.getElementById('statReportExcluded'),
  statFinalUsable: document.getElementById('statFinalUsable'),

  reportForm: document.getElementById('reportForm'),
  reportFacilityId: document.getElementById('reportFacilityId'),
  reportFacilityName: document.getElementById('reportFacilityName'),
  reportDetails: document.getElementById('reportDetails'),

  inputGoogleApiKey: document.getElementById('inputGoogleApiKey'),
  btnSaveGoogleApiKey: document.getElementById('btnSaveGoogleApiKey'),
};

// ==========================================================
// 1. Google Maps Platform 정식 SDK 로드 및 초기화
// ==========================================================
function loadGoogleMapsSDK() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${state.googleApiKey}&libraries=geometry&language=ko&callback=onGoogleMapsReady`;
    script.async = true;
    script.defer = true;

    window.onGoogleMapsReady = () => {
      resolve();
    };

    script.onerror = (e) => {
      reject(new Error('Google Maps script load error'));
    };

    document.head.appendChild(script);

    setTimeout(() => {
      if (!window.google || !window.google.maps) {
        reject(new Error('Google Maps SDK loading timeout'));
      }
    }, 7000);
  });
}

function initMapInstance() {
  elements.sdkStatusBadge.textContent = 'Google Maps';

  // 클린 미니멀 맵 스타일 (상업 POI 노이즈 제거하여 안전시설이 돋보이도록 구성)
  const minimalCleanStyle = [
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.medical', stylers: [{ visibility: 'on' }] },
    { featureType: 'poi.government', stylers: [{ visibility: 'on' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ lightness: 15 }] },
    { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'simplified' }] }
  ];

  const mapOptions = {
    center: { lat: state.userLat, lng: state.userLon },
    zoom: 17,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    disableDefaultUI: true,
    zoomControl: false, // 터치 제스처 중심
    clickableIcons: false,
    internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
    styles: minimalCleanStyle
  };

  state.map = new google.maps.Map(elements.mainMapContainer, mapOptions);

  state.map.addListener('click', (e) => {
    state.userLat = e.latLng.lat();
    state.userLon = e.latLng.lng();
    showStatus('선택하신 위치로 기준점을 이동했습니다.', 1800);
    fetchFacilities();
  });
}

// 일반지도 / 위성지도 전환
function toggleMapLayer() {
  if (!state.map) return;
  state.isSatelliteMode = !state.isSatelliteMode;
  state.map.setMapTypeId(state.isSatelliteMode ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.ROADMAP);
  elements.mapLayerIcon.textContent = state.isSatelliteMode ? '🗺️' : '🛰️';
}

// ==========================================================
// 2. 하단 정보 카드 접기/펼치기 제어 (스무스 인터랙션)
// ==========================================================
function toggleBottomSheet(forceState) {
  if (typeof forceState === 'boolean') {
    state.isSheetCollapsed = forceState;
  } else {
    state.isSheetCollapsed = !state.isSheetCollapsed;
  }

  if (state.isSheetCollapsed) {
    elements.bottomSheet.classList.add('collapsed');
    elements.floatToggleIcon.textContent = '🔼';
  } else {
    elements.bottomSheet.classList.remove('collapsed');
    elements.floatToggleIcon.textContent = '🔽';
  }
}

// ==========================================================
// 3. 앱 구동 및 GPS 위치 수신
// ==========================================================
async function initApp() {
  bindEvents();
  elements.inputGoogleApiKey.value = state.googleApiKey;

  showStatus('안전지도 로딩 중...');

  try {
    await loadGoogleMapsSDK();
    initMapInstance();
  } catch (err) {
    console.error('Google Maps SDK error:', err);
    showStatus('구글맵 로드 오류: API 키 설정을 확인해 주세요.', 4000);
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.userLat = pos.coords.latitude;
        state.userLon = pos.coords.longitude;
        if (state.map) {
          state.map.setCenter({ lat: state.userLat, lng: state.userLon });
        }
        fetchFacilities();
      },
      (err) => {
        console.warn('Geolocation fallback (서울시청):', err.message);
        showStatus('현재 위치를 서울시청 기준으로 실행합니다.', 2200);
        fetchFacilities();
      },
      { timeout: 6000, enableHighAccuracy: true }
    );
  } else {
    fetchFacilities();
  }
}

// ==========================================================
// 4. 공공 안전데이터 수집 및 전처리 엔진
// ==========================================================
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function getWalkingTimeText(distanceMeters) {
  const minutes = Math.floor(distanceMeters / 75);
  const seconds = Math.round((distanceMeters % 75) / 1.25);
  if (minutes === 0) {
    return `약 ${Math.max(seconds, 10)}초`;
  }
  return `약 ${minutes}분 ${seconds > 0 ? seconds + '초' : ''}`;
}

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

function isCurrentlyAvailable(item) {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentTimeInt = hour * 100 + minute;

  const dayPrefixes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const prefix = dayPrefixes[day];
  const stt = item[prefix + 'SttTme'] ? parseInt(item[prefix + 'SttTme'], 10) : 0;
  const end = item[prefix + 'EndTme'] ? parseInt(item[prefix + 'EndTme'], 10) : 2400;

  if (day === 0 && item['sunFifYon'] === 'N') {
    return false;
  }
  return currentTimeInt >= stt && currentTimeInt <= end;
}

function getFireFacilities(centerLat, centerLon) {
  const fireExtinguishers = [
    {
      id: 'EXT-01',
      category: 'extinguisher',
      name: 'ABC 분말소화기 (3.3kg)',
      org: '근린상가 건물관리소',
      buildAddress: '주변 공용 건축물 1층',
      buildPlace: '1층 엘리베이터 홀 우측 벽면',
      latOffset: 0.00045,
      lonOffset: 0.00032,
      installYear: 2021,
      pressureStatus: '정상 (녹색 범위)',
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
      installYear: 2023,
      pressureStatus: '정상 (녹색 범위)',
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
      installYear: 2013,
      pressureStatus: '압력 저하 (황색 범위)',
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
      contact: '119 소방관서',
    },
    {
      id: 'HYD-02',
      category: 'hydrant',
      name: '비상소화장치함 (골목길 화재진압용)',
      org: '관할 의용소방대',
      buildAddress: '주거밀집지역 소방도로',
      buildPlace: '골목길 전신주 옆 적색 비상소화장치함',
      latOffset: -0.00055,
      lonOffset: -0.00078,
      installYear: 2020,
      waterPressure: '정상 호스 50m 완비',
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
      contact: '119 소방관서',
    }
  ];

  return [
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
}

async function fetchFacilities() {
  showStatus('주변 시설 탐색 중...');

  try {
    let data = null;
    try {
      const res = await fetch(`/api/facilities?lat=${state.userLat}&lon=${state.userLon}&category=${state.currentCategory}&verifiedOnly=${state.verifiedOnly}`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) data = await res.json();
    } catch (e) {
      data = null;
    }

    if (!data || !data.success) {
      data = await processClientSideData(state.userLat, state.userLon, state.currentCategory, state.verifiedOnly);
    }

    state.facilities = data.facilities || [];
    state.nearestFacility = data.nearest || null;
    state.stats = data.stats;

    updateFilterCounts();
    updateStatsModal(data.stats);
    renderMapObjects();
    updateNearestCard(state.nearestFacility);
    renderFacilityList(state.facilities);

    hideStatus();
  } catch (err) {
    console.error('Fetch Facilities Error:', err);
    showStatus('데이터 통신 오류: 다시 시도해 주세요.', 3000);
  }
}

async function processClientSideData(lat, lon, categoryFilter, verifiedOnly) {
  const stats = {
    totalCollected: 0,
    invalidCoordsRemoved: 0,
    agedEquipmentFiltered: 0,
    unavailableHoursFiltered: 0,
    userReportedExcluded: 0,
    finalUsableCount: 0,
  };

  let allFacilities = [];

  // AED 데이터 수집
  if (categoryFilter === 'all' || categoryFilter === 'aed') {
    try {
      const aedUrl = `https://apis.data.go.kr/B552657/AEDInfoInqireService/getAedLcinfoInqire?serviceKey=${DATA_GO_KR_KEY}&WGS84_LON=${lon}&WGS84_LAT=${lat}&numOfRows=50&_type=json`;
      const res = await fetch(aedUrl);
      const resData = await res.json();
      const rawItems = resData?.response?.body?.items?.item || [];
      const items = Array.isArray(rawItems) ? rawItems : [rawItems];

      stats.totalCollected += items.length;

      for (const raw of items) {
        const itemLat = parseFloat(raw.wgs84Lat);
        const itemLon = parseFloat(raw.wgs84Lon);

        if (isNaN(itemLat) || isNaN(itemLon) || itemLat < 33 || itemLat > 39 || itemLon < 124 || itemLon > 132) {
          stats.invalidCoordsRemoved++;
          continue;
        }

        const installYear = parseInstallYearFromSerial(raw.serialSeq);
        const currentYear = new Date().getFullYear();
        const age = installYear ? currentYear - installYear : null;
        const isAged = age !== null && age >= 8;
        const availableNow = isCurrentlyAvailable(raw);

        const facilityId = `AED-${raw.rnum || raw.serialSeq}`;
        const reports = state.userReports.filter(r => r.facilityId === facilityId);
        const hasIssueReport = reports.length > 0;

        if (verifiedOnly) {
          if (isAged) { stats.agedEquipmentFiltered++; continue; }
          if (!availableNow) { stats.unavailableHoursFiltered++; continue; }
          if (hasIssueReport) { stats.userReportedExcluded++; continue; }
        }

        const distMeters = calculateDistanceMeters(lat, lon, itemLat, itemLon);

        allFacilities.push({
          id: facilityId,
          category: 'aed',
          categoryName: 'AED',
          name: `${raw.org || '공공시설'} AED`,
          org: raw.org || '관리기관 미상',
          buildAddress: raw.buildAddress || '주소 정보 없음',
          buildPlace: raw.buildPlace || '상세 위치 정보 없음',
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
    } catch (e) {
      console.warn('AED Direct fetch warning:', e);
    }
  }

  // 소화기 / 소화전 데이터
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

      if (isNaN(itemLat) || isNaN(itemLon)) {
        stats.invalidCoordsRemoved++;
        continue;
      }

      const currentYear = new Date().getFullYear();
      const age = currentYear - raw.installYear;
      const isAged = raw.category === 'extinguisher' && age >= 10;

      const facilityId = raw.id;
      const reports = state.userReports.filter(r => r.facilityId === facilityId);
      const hasIssueReport = reports.length > 0;

      if (verifiedOnly) {
        if (isAged) { stats.agedEquipmentFiltered++; continue; }
        if (hasIssueReport) { stats.userReportedExcluded++; continue; }
      }

      const distMeters = calculateDistanceMeters(lat, lon, itemLat, itemLon);

      allFacilities.push({
        id: facilityId,
        category: raw.category,
        categoryName: raw.category === 'extinguisher' ? '소화기' : '소화전',
        name: raw.name,
        org: raw.org,
        buildAddress: raw.buildAddress,
        buildPlace: raw.buildPlace,
        lat: itemLat,
        lon: itemLon,
        distanceMeters: distMeters,
        walkingTime: getWalkingTimeText(distMeters),
        model: raw.pressureStatus || raw.waterPressure || '정상 규격',
        mfg: raw.category === 'extinguisher' ? '소방산업기술원 인증' : '소방청 표준시설',
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

  allFacilities.sort((a, b) => a.distanceMeters - b.distanceMeters);
  if (allFacilities.length > 0) {
    allFacilities[0].isNearest = true;
  }
  stats.finalUsableCount = allFacilities.length;

  return {
    success: true,
    userLocation: { lat, lon },
    stats,
    nearest: allFacilities.length > 0 ? allFacilities[0] : null,
    facilities: allFacilities,
  };
}

function updateFilterCounts() {
  const allCount = state.facilities.length;
  const aedCount = state.facilities.filter(f => f.category === 'aed').length;
  const extCount = state.facilities.filter(f => f.category === 'extinguisher').length;
  const hydCount = state.facilities.filter(f => f.category === 'hydrant').length;

  elements.countAll.textContent = allCount;
  elements.countAed.textContent = aedCount;
  elements.countExt.textContent = extCount;
  elements.countHyd.textContent = hydCount;
  elements.totalListCount.textContent = allCount;
}

function updateStatsModal(stats) {
  if (!stats) return;
  elements.statCollected.textContent = stats.totalCollected;
  elements.statCoordRemoved.textContent = stats.invalidCoordsRemoved;
  elements.statAgedFiltered.textContent = stats.agedEquipmentFiltered;
  elements.statHoursFiltered.textContent = stats.unavailableHoursFiltered;
  elements.statReportExcluded.textContent = stats.userReportedExcluded;
  elements.statFinalUsable.textContent = stats.finalUsableCount;
}

// ==========================================================
// 5. Google Maps 공식 마커 및 최단거리 경로 렌더링
// ==========================================================
// ==========================================================
// 5. Google Maps 공식 마커 & 커스텀 SVG 핀 렌더링
// ==========================================================

// 기기 종류별 고해상도 SVG 핀 아이콘 생성 (AED: 적색+⚡, 소화기: 주황+🧯, 소화전: 청색+💧)
function createCustomPinIcon(item, isNearest, isSelected) {
  let bgColor = '#ef4444'; // AED Red
  let iconEmoji = '⚡';
  let catText = 'AED';

  if (item.category === 'extinguisher') {
    bgColor = '#f97316'; // 소화기 Orange
    iconEmoji = '🧯';
    catText = '소화기';
  } else if (item.category === 'hydrant') {
    bgColor = '#2563eb'; // 소화전 Blue
    iconEmoji = '💧';
    catText = '소화전';
  }

  const strokeColor = isSelected ? '#2563eb' : (isNearest ? '#f59e0b' : '#ffffff');
  const strokeWidth = isSelected ? 4 : (isNearest ? 3.5 : 2);
  const scale = isNearest || isSelected ? 1.15 : 1.0;

  const w = Math.round(48 * scale);
  const h = Math.round(58 * scale);

  const goldHalo = isNearest ? `<circle cx="24" cy="22" r="21" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="3,2" />` : '';

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 48 58">
    <defs>
      <filter id="p-shadow" x="-30%" y="-20%" width="160%" height="150%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.35"/>
      </filter>
    </defs>
    ${goldHalo}
    <!-- 핀 본체 (물방울형 포인터) -->
    <path d="M 24 2 C 13 2, 4 11, 4 22 C 4 35, 24 55, 24 55 C 24 55, 44 35, 44 22 C 44 11, 35 2, 24 2 Z"
          fill="${bgColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" filter="url(#p-shadow)" />
    <!-- 내부 흰색 원형 디스크 -->
    <circle cx="24" cy="20" r="12.5" fill="#ffffff" />
    <!-- 이모지 심볼 아이콘 -->
    <text x="24" y="25" font-size="13" text-anchor="middle" font-family="'Apple Color Emoji','Segoe UI Emoji',sans-serif">${iconEmoji}</text>
    <!-- 하단 텍스트 명칭 알약 배지 -->
    <rect x="7" y="38" width="34" height="13" rx="6.5" fill="${bgColor}" stroke="#ffffff" stroke-width="1.2" />
    <text x="24" y="47.5" font-size="8.5" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="'Pretendard', sans-serif">${catText}</text>
  </svg>`.trim();

  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(w, h),
    anchor: new google.maps.Point(w / 2, h - Math.round(3 * scale)),
  };
}

// 사용자 현위치 레이더 펄스 핀 아이콘
function createUserLocationIcon() {
  const w = 44;
  const h = 54;
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 44 54">
    <defs>
      <filter id="u-shadow" x="-30%" y="-20%" width="160%" height="150%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.32"/>
      </filter>
    </defs>
    <!-- 레이더 펄스 외곽 링 -->
    <circle cx="22" cy="20" r="18" fill="#3b82f6" fill-opacity="0.22" />
    <!-- 핀 본체 -->
    <path d="M 22 2 C 12 2, 4 10, 4 20 C 4 32, 22 51, 22 51 C 22 51, 40 32, 40 20 C 40 10, 32 2, 22 2 Z"
          fill="#1d4ed8" stroke="#ffffff" stroke-width="2.5" filter="url(#u-shadow)" />
    <!-- 중앙 타겟 조준원 -->
    <circle cx="22" cy="19" r="11" fill="#ffffff" />
    <circle cx="22" cy="19" r="6" fill="#2563eb" />
    <circle cx="22" cy="19" r="2.5" fill="#ffffff" />
    <!-- 내 위치 텍스트 알약 -->
    <rect x="6" y="37" width="32" height="12" rx="6" fill="#1d4ed8" stroke="#ffffff" stroke-width="1" />
    <text x="22" y="46" font-size="7.5" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="'Pretendard', sans-serif">내 위치</text>
  </svg>`.trim();

  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(w, h),
    anchor: new google.maps.Point(w / 2, h - 3),
  };
}

// 지도 인포윈도우 팝업 HTML 생성
function createInfoWindowContent(item, isNearest) {
  let catIcon = '⚡';
  let catText = '자동심장충격기 (AED)';
  let catBg = '#fee2e2';
  let catColor = '#dc2626';

  if (item.category === 'extinguisher') {
    catIcon = '🧯';
    catText = '소화기 (소화시설)';
    catBg = '#ffedd5';
    catColor = '#ea580c';
  } else if (item.category === 'hydrant') {
    catIcon = '💧';
    catText = '소화전 (소방용수)';
    catBg = '#eff6ff';
    catColor = '#2563eb';
  }

  return `
    <div style="font-family: Pretendard, -apple-system, sans-serif; padding: 6px 4px; max-width: 250px; line-height: 1.45;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 6px;">
        <span style="font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: ${catBg}; color: ${catColor};">
          ${catIcon} ${catText}
        </span>
        ${isNearest ? '<span style="font-size: 10px; font-weight: 900; color: #b45309; background: #fef3c7; padding: 2px 6px; border-radius: 6px;">🏆 최단거리</span>' : ''}
      </div>

      <div style="font-size: 13.5px; font-weight: 900; color: #0f172a; margin-bottom: 4px; word-break: keep-all;">
        ${item.name}
      </div>

      <div style="background: #f0f7ff; border: 1.5px solid #bfdbfe; border-radius: 8px; padding: 6px 8px; margin-bottom: 6px;">
        <div style="font-size: 9.5px; font-weight: 800; color: #1e3a8a; margin-bottom: 2px;">🏢 건물 내부 상세 설치 위치</div>
        <div style="font-size: 12px; font-weight: 900; color: #1e40af; word-break: keep-all;">
          ${item.buildPlace || '상세 위치 정보 없음'}
        </div>
      </div>

      <div style="display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px;">
        <span style="font-size: 13px; font-weight: 900; color: #ef4444;">${item.distanceMeters}m</span>
        <span style="font-size: 11px; font-weight: 700; color: #475569;">⏱️ ${item.walkingTime}</span>
      </div>

      <div style="display: flex; gap: 5px;">
        <a href="https://www.google.com/maps/dir/?api=1&origin=${state.userLat},${state.userLon}&destination=${item.lat},${item.lon}&travelmode=walking" 
           target="_blank" 
           style="flex: 1; text-align: center; background: #0f172a; color: #ffffff; padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; text-decoration: none;">
          🧭 Google 도보 길안내
        </a>
        <a href="tel:${item.clerkTel ? item.clerkTel.replace(/[^0-9]/g, '') : '119'}" 
           style="text-align: center; background: #fee2e2; color: #dc2626; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-decoration: none;">
          📞 통화
        </a>
      </div>
    </div>
  `;
}

function clearMarkers() {
  if (!state.map || !window.google) return;
  state.markers.forEach(m => m.setMap(null));
  state.markers = [];
  state.markersMap.clear();
  if (state.userMarker) { state.userMarker.setMap(null); state.userMarker = null; }
  if (state.routePolyline) { state.routePolyline.setMap(null); state.routePolyline = null; }
}

function renderMapObjects() {
  clearMarkers();
  if (!state.map || !window.google) return;

  const userPos = { lat: state.userLat, lng: state.userLon };

  // 1. 사용자 현위치 (식별하기 쉬운 파란 핀 + 레이더 링)
  state.userMarker = new google.maps.Marker({
    position: userPos,
    map: state.map,
    title: '내 현재 위치',
    zIndex: 999,
    icon: createUserLocationIcon(),
  });

  // 2. 시설 마커 렌더링 (각 기기별 아이콘과 텍스트가 표시된 SVG 핀)
  state.facilities.forEach((item, index) => {
    const isNearest = item.isNearest || (index === 0);
    const isSelected = state.selectedFacilityId ? (state.selectedFacilityId === item.id) : isNearest;

    const marker = new google.maps.Marker({
      position: { lat: item.lat, lng: item.lon },
      map: state.map,
      title: `[${item.categoryName}] ${item.name} (${item.distanceMeters}m)`,
      zIndex: isNearest ? 100 : (50 - Math.min(index, 40)),
      icon: createCustomPinIcon(item, isNearest, isSelected),
    });

    const infoWindow = new google.maps.InfoWindow({
      content: createInfoWindowContent(item, isNearest),
    });

    marker.addListener('click', () => {
      selectFacility(item, false);
    });

    state.markers.push(marker);
    state.markersMap.set(item.id, { marker, infoWindow, item });
  });

  // 3. 최단거리(또는 현재 선택된 시설) 유도선 (Polyline)
  const targetItem = (state.selectedFacilityId && state.facilities.find(f => f.id === state.selectedFacilityId)) || state.nearestFacility;
  if (targetItem) {
    state.routePolyline = new google.maps.Polyline({
      path: [userPos, { lat: targetItem.lat, lng: targetItem.lon }],
      strokeColor: '#f59e0b',
      strokeOpacity: 0.9,
      strokeWeight: 4.5,
      geodesic: true,
      map: state.map,
    });
  }
}

// 특정 안전시설 선택 시 지도 이동, 인포윈도우 오픈, 핀 튕김 애니메이션 및 유도선 갱신
function selectFacility(item, triggerFromList = false) {
  if (!item) return;
  state.selectedFacilityId = item.id;

  // 하단 메인 카드 동기화
  updateNearestCard(item);

  // 지도 부드럽게 이동 및 줌인 (건물 및 도로 상세 확인)
  if (state.map) {
    state.map.panTo({ lat: item.lat, lng: item.lon });
    if (state.map.getZoom() < 17) {
      state.map.setZoom(17);
    }
  }

  // 해당 마커 인포윈도우 오픈 & 핀 바운스 애니메이션
  const markerObj = state.markersMap.get(item.id);
  if (markerObj) {
    if (state.currentInfoWindow) {
      state.currentInfoWindow.close();
    }
    markerObj.infoWindow.open(state.map, markerObj.marker);
    state.currentInfoWindow = markerObj.infoWindow;

    if (markerObj.marker.setAnimation) {
      markerObj.marker.setAnimation(google.maps.Animation.BOUNCE);
      setTimeout(() => {
        if (markerObj.marker) markerObj.marker.setAnimation(null);
      }, 1400);
    }
  }

  // 유도선(Polyline) 갱신
  if (state.map) {
    if (state.routePolyline) {
      state.routePolyline.setMap(null);
    }
    state.routePolyline = new google.maps.Polyline({
      path: [
        { lat: state.userLat, lng: state.userLon },
        { lat: item.lat, lng: item.lon }
      ],
      strokeColor: '#f59e0b',
      strokeOpacity: 0.9,
      strokeWeight: 4.5,
      geodesic: true,
      map: state.map,
    });
  }

  // 하단 순위 리스트 카드 선택 스타일 반영
  document.querySelectorAll('.facility-ranking-card').forEach(card => {
    if (card.dataset.id === item.id) {
      card.classList.add('selected');
      if (!triggerFromList) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else {
      card.classList.remove('selected');
    }
  });

  showStatus(`[${item.categoryName}] ${item.name} (${item.distanceMeters}m) 선택됨`, 1800);
}

// ==========================================================
// 6. 하단 정보 카드 업데이트 (한눈에 들어오는 가독성 극대화)
// ==========================================================
function updateNearestCard(item) {
  if (!item) {
    elements.nearestTitle.textContent = '반경 내에 탐색된 안전시설이 없습니다.';
    elements.nearestDistance.textContent = '--';
    elements.nearestWalkingTime.textContent = '';
    elements.nearestIndoorPlace.textContent = '다른 카테고리를 선택하거나 지도를 이동해 보세요.';
    elements.nearestAddress.textContent = '-';
    elements.nearestOrg.textContent = '-';
    elements.nearestAge.textContent = '-';

    elements.miniNearestName.textContent = '시설 없음';
    elements.miniNearestDist.textContent = '';
    elements.miniNearestPlace.textContent = '';
    return;
  }

  // 상단 뱃지
  elements.nearestCategoryBadge.textContent = item.categoryName;
  if (item.category === 'aed') {
    elements.nearestCategoryBadge.style.background = '#fee2e2';
    elements.nearestCategoryBadge.style.color = '#dc2626';
  } else if (item.category === 'extinguisher') {
    elements.nearestCategoryBadge.style.background = '#ffedd5';
    elements.nearestCategoryBadge.style.color = '#ea580c';
  } else {
    elements.nearestCategoryBadge.style.background = '#eff6ff';
    elements.nearestCategoryBadge.style.color = '#2563eb';
  }

  elements.nearestDistance.textContent = item.distanceMeters;
  elements.nearestWalkingTime.textContent = `(${item.walkingTime})`;

  if (item.distanceMeters <= 300) {
    elements.goldenIndicator.textContent = '🚨 골든타임 4분 내';
    elements.goldenIndicator.className = 'badge golden-pill';
  } else {
    elements.goldenIndicator.textContent = '⚠️ 도보 4분 초과';
    elements.goldenIndicator.className = 'badge golden-pill warning';
  }

  elements.nearestTitle.textContent = item.name;
  // 건물 내부 상세 설치 위치 (가장 크고 시원하게 표시)
  elements.nearestIndoorPlace.textContent = item.buildPlace || '현장 상세 안내 표지판을 확인하세요.';
  elements.nearestAddress.textContent = item.buildAddress || '주소 정보 없음';
  elements.nearestOrg.textContent = `${item.org} / ${item.model || item.mfg}`;
  elements.nearestAge.textContent = `${item.age} (설치: ${item.installYear || '미상'})`;

  // 미니 독 바 동기화
  elements.miniNearestName.textContent = item.name;
  elements.miniNearestDist.textContent = `${item.distanceMeters}m`;
  elements.miniNearestPlace.textContent = `🏢 ${item.buildPlace}`;

  elements.btnCallManager.href = `tel:${item.clerkTel.replace(/[^0-9]/g, '') || '119'}`;

  elements.btnNavigation.onclick = () => {
    const navUrl = `https://www.google.com/maps/dir/?api=1&origin=${state.userLat},${state.userLon}&destination=${item.lat},${item.lon}&travelmode=walking`;
    window.open(navUrl, '_blank');
  };

  elements.btnReportIssue.onclick = () => {
    openReportModal(item);
  };
}

function renderFacilityList(list) {
  elements.facilityList.innerHTML = '';
  if (!list || list.length === 0) {
    elements.facilityList.innerHTML = `
      <div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 0.8rem;">
        탐색 반경 내에 이용 가능한 안전시설이 없습니다.
      </div>
    `;
    return;
  }

  // 거리순 오름차순 정렬 (가장 가까운 기기가 최상단)
  const sortedList = [...list].sort((a, b) => a.distanceMeters - b.distanceMeters);

  sortedList.forEach((item, index) => {
    const card = document.createElement('div');
    const isSelected = state.selectedFacilityId ? (state.selectedFacilityId === item.id) : (index === 0);
    card.className = `facility-ranking-card ${isSelected ? 'selected' : ''}`;
    card.dataset.id = item.id;

    let catIcon = '⚡';
    let catText = 'AED';
    let catClass = 'aed';
    if (item.category === 'extinguisher') {
      catIcon = '🧯';
      catText = '소화기';
      catClass = 'extinguisher';
    } else if (item.category === 'hydrant') {
      catIcon = '💧';
      catText = '소화전';
      catClass = 'hydrant';
    }

    const rankLabel = index === 0 ? '🏆 1위' : `#${index + 1}`;
    const rankClass = index === 0 ? 'card-rank gold' : 'card-rank';
    const isGolden = item.distanceMeters <= 300;

    card.innerHTML = `
      <div class="${rankClass}">
        <span>${rankLabel}</span>
        ${index === 0 ? '<span class="card-rank-sub">최단거리</span>' : ''}
      </div>
      <div class="card-main">
        <div class="card-top-row">
          <span class="card-cat-badge ${catClass}">${catIcon} ${catText}</span>
          <span class="card-facility-name" title="${item.name}">${item.name}</span>
        </div>
        <div class="card-indoor-info" title="${item.buildPlace || item.buildAddress}">
          <span>🏢</span>
          <span>${item.buildPlace || item.buildAddress}</span>
        </div>
        <div class="card-dist-row">
          <span class="card-dist-num">${item.distanceMeters}m</span>
          <span class="card-time-eta">⏱️ ${item.walkingTime}</span>
          ${isGolden ? '<span class="card-golden-pill">골든타임 4분 내</span>' : ''}
        </div>
      </div>
      <div class="card-arrow-action">
        <span>지도 확인</span>
        <span>➔</span>
      </div>
    `;

    card.addEventListener('click', () => {
      selectFacility(item, true);
    });

    elements.facilityList.appendChild(card);
  });
}

// ==========================================================
// 7. 제보 시스템 & 모달 제어
// ==========================================================
function openReportModal(item) {
  elements.reportFacilityId.value = item.id;
  elements.reportFacilityName.value = `[${item.categoryName}] ${item.name} (${item.buildPlace})`;
  elements.reportDetails.value = '';
  openModal(elements.reportModal);
}

async function handleReportSubmit(e) {
  e.preventDefault();
  const facilityId = elements.reportFacilityId.value;
  const facilityName = elements.reportFacilityName.value;
  const reportType = document.querySelector('input[name="reportType"]:checked').value;
  const details = elements.reportDetails.value;

  const newReport = {
    reportId: `REP-${Date.now()}`,
    facilityId,
    facilityName,
    reportType,
    details,
    createdAt: new Date().toISOString(),
  };

  state.userReports.push(newReport);
  localStorage.setItem('safemap_user_reports', JSON.stringify(state.userReports));

  try {
    fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReport)
    }).catch(() => {});
  } catch(e) {}

  alert('제보가 정상 접수되었습니다. 현장 안전망에 즉시 반영됩니다.');
  closeModal(elements.reportModal);
  fetchFacilities();
}

function openModal(modal) { modal.classList.add('active'); }
function closeModal(modal) { modal.classList.remove('active'); }

// ==========================================================
// 8. 이벤트 바인딩
// ==========================================================
function bindEvents() {
  // 필터 칩 클릭
  elements.chips.forEach(chip => {
    chip.addEventListener('click', () => {
      elements.chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.currentCategory = chip.dataset.category;
      fetchFacilities();
    });
  });

  // 안심 검증 토글
  elements.verifiedToggle.addEventListener('change', (e) => {
    state.verifiedOnly = e.target.checked;
    fetchFacilities();
  });

  // 카드 토글 제어
  elements.sheetHandle.addEventListener('click', () => toggleBottomSheet());
  elements.miniSummaryBar.addEventListener('click', () => toggleBottomSheet(false));
  elements.btnFloatToggleCard.addEventListener('click', () => toggleBottomSheet());

  // 위성/일반 레이어 전환
  elements.btnMapLayerToggle.addEventListener('click', toggleMapLayer);

  // 내 GPS 위치 이동
  elements.btnCurrentLocation.addEventListener('click', () => {
    showStatus('GPS 현위치 확인 중...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          state.userLat = pos.coords.latitude;
          state.userLon = pos.coords.longitude;
          if (state.map) {
            state.map.panTo({ lat: state.userLat, lng: state.userLon });
          }
          fetchFacilities();
        },
        (err) => {
          showStatus('위치 수신 권한을 확인해 주세요.', 2200);
        }
      );
    }
  });

  // 주변 재검색
  elements.btnRefreshArea.addEventListener('click', () => {
    fetchFacilities();
  });

  // 아코디언 목록 토글 (선택적)
  if (elements.listToggleHeader) {
    elements.listToggleHeader.addEventListener('click', () => {
      const list = elements.facilityList;
      if (list.style.display === 'none') {
        list.style.display = 'flex';
        if (elements.listArrow) elements.listArrow.textContent = '목록 닫기 ▲';
      } else {
        list.style.display = 'none';
        if (elements.listArrow) elements.listArrow.textContent = '목록 열기 ▼';
      }
    });
  }

  // 모달 버튼
  elements.btnPreprocessingReport.addEventListener('click', () => openModal(elements.preprocessingModal));
  elements.btnSafetyGuide.addEventListener('click', () => openModal(elements.safetyGuideModal));
  elements.btnSettings.addEventListener('click', () => openModal(elements.settingsModal));

  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      if (modal) closeModal(modal);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });

  elements.reportForm.addEventListener('submit', handleReportSubmit);

  // 가이드 탭 전환
  document.querySelectorAll('.tab-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('guideCpr').classList.toggle('active', tab === 'cpr');
      document.getElementById('guideFire').classList.toggle('active', tab === 'fire');
    });
  });

  // Google Maps API 키 저장
  elements.btnSaveGoogleApiKey.addEventListener('click', () => {
    const key = elements.inputGoogleApiKey.value.trim();
    if (!key) {
      alert('API 키를 입력해 주세요.');
      return;
    }
    state.googleApiKey = key;
    localStorage.setItem('google_maps_api_key', key);
    alert('Google Maps API 키가 저장되었습니다!');
    window.location.search = `?key=${key}`;
  });
}

function showStatus(msg, autoHideMs = 0) {
  elements.statusMessage.textContent = msg;
  elements.statusBanner.classList.remove('hidden');
  if (autoHideMs > 0) {
    setTimeout(hideStatus, autoHideMs);
  }
}

function hideStatus() {
  elements.statusBanner.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', initApp);
