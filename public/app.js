/**
 * 골든타임 세이프맵 (GoldenTime SafeMap)
 * 미니멀 클린 UX/UI & Google Maps Platform 정식 SDK 연동
 */

// 환경설정 및 API 키 동적 로드 (Vercel 환경변수 /api/config 연동)
const urlParams = new URLSearchParams(window.location.search);
const keyFromUrl = urlParams.get('key') || urlParams.get('gkey');

// 전역 상태
const state = {
  userLat: 37.5665,
  userLon: 126.9780,
  currentCategory: 'all',
  verifiedOnly: true,
  facilities: [],
  nearestFacility: null,
  stats: null,
  
  googleApiKey: keyFromUrl || '',
  map: null,
  isSatelliteMode: false,
  
  markers: [],
  markersMap: new Map(),
  selectedFacilityId: null,
  userMarker: null,
  routePolyline: null,
  currentInfoWindow: null,

  // 인터랙티브 스파이더파이어 상태
  spiderMarkers: [],
  spiderLines: [],
  spiderCenterMarker: null,
  activeClusterMarker: null,
  activeClusterId: null,
  
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

  // 위치 검색 및 GPS 버튼
  locationSearchInput: document.getElementById('locationSearchInput'),
  btnClearSearch: document.getElementById('btnClearSearch'),
  btnSearchLocation: document.getElementById('btnSearchLocation'),
  btnGpsDirect: document.getElementById('btnGpsDirect'),

  // 밀집 시설 선택 모달
  clusterSelectionModal: document.getElementById('clusterSelectionModal'),
  clusterTitle: document.getElementById('clusterTitle'),
  btnCloseClusterModal: document.getElementById('btnCloseClusterModal'),
  clusterItemsContainer: document.getElementById('clusterItemsContainer'),

  // 실시간 인앱 길안내 패널 요소
  inAppNavPanel: document.getElementById('inAppNavigationPanel'),
  btnCloseNav: document.getElementById('btnCloseNav'),
  navDestName: document.getElementById('navDestName'),
  navDestPlace: document.getElementById('navDestPlace'),
  navRealDistance: document.getElementById('navRealDistance'),
  navRealDuration: document.getElementById('navRealDuration'),
  navStepIcon: document.getElementById('navStepIcon'),
  navStepMain: document.getElementById('navStepMain'),
  navStepSub: document.getElementById('navStepSub'),
  navStepsList: document.getElementById('navStepsList'),
  btnToggleSteps: document.getElementById('btnToggleSteps'),
  toggleStepsText: document.getElementById('toggleStepsText'),
  btnFollowNavGps: document.getElementById('btnFollowNavGps'),
  btnFitNavRoute: document.getElementById('btnFitNavRoute'),

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
};

// ==========================================================
// 1. 서버 환경설정 및 Google Maps Platform 정식 SDK 로드
// ==========================================================
async function loadServerConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const config = await res.json();
        if (config.googleMapsApiKey && !state.googleApiKey) {
          state.googleApiKey = config.googleMapsApiKey;
        }
      }
    }
  } catch (e) {
    console.warn('Config fetch warning:', e);
  }

  // URL 디버그 파라미터가 명시된 경우 보조 지원 (?key=...)
  const urlParams = new URLSearchParams(window.location.search);
  const keyFromUrl = urlParams.get('key') || urlParams.get('gkey');
  if (keyFromUrl) {
    state.googleApiKey = keyFromUrl;
  }
}

function loadGoogleMapsSDK() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    if (!state.googleApiKey) {
      reject(new Error('Google Maps API 키가 로드되지 않았습니다. 서버 환경변수(GOOGLE_MAPS_API_KEY)를 확인해 주세요.'));
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

  // 지도 빈 곳 클릭 시 스파이더파이어 접기 및 인포윈도우 닫기
  state.map.addListener('click', () => {
    collapseSpider();
    if (state.currentInfoWindow) {
      state.currentInfoWindow.close();
      state.currentInfoWindow = null;
    }
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

function renderMapFallbackNotice(errorMessage) {
  if (!elements.mainMapContainer) return;
  elements.mainMapContainer.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 24px; color: #475569; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="width: 64px; height: 64px; border-radius: 50%; background: #eff6ff; display: flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(37,99,235,0.12);">🗺️</div>
      <h3 style="font-size: 19px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0;">Google Maps 활성화 대기 중</h3>
      <p style="font-size: 14px; max-width: 380px; line-height: 1.6; color: #64748b; margin: 0 0 20px 0;">
        서버 환경변수(GOOGLE_MAPS_API_KEY) 확인 및 지도 초기화를 진행 중입니다. 잠시 후 새로고침해 주세요.
      </p>
      <button id="btnReloadMapDirect" style="padding: 11px 22px; background: #2563eb; color: #fff; border: none; border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.25); transition: background 0.2s;">
        🔄 새로고침
      </button>
    </div>
  `;
  const btn = document.getElementById('btnReloadMapDirect');
  if (btn) {
    btn.addEventListener('click', () => {
      window.location.reload();
    });
  }
}

// ==========================================================
// 3. 앱 구동 및 GPS 위치 수신
// ==========================================================
async function initApp() {
  bindEvents();

  // 서버 환경변수(/api/config)로부터 키 로드
  await loadServerConfig();

  showStatus('안전지도 로딩 중...');

  try {
    await loadGoogleMapsSDK();
    initMapInstance();
  } catch (err) {
    console.error('Google Maps SDK error:', err);
    showStatus('구글맵 로드 대기: API 키 설정을 확인해 주세요.', 6000);
    renderMapFallbackNotice(err.message);
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
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          data = await res.json();
        }
      }
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

    if (state.map) {
      hideStatus();
    }
    // 실제 도로망 보행 거리 비동기 계산 및 순위 보정
    updateFacilitiesRealWalkingDistances();
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

  // AED 데이터 수집 (서버 프록시 오프라인 대비 클라이언트 보조 처리)
  if (categoryFilter === 'all' || categoryFilter === 'aed') {
    let items = [];
    if (window.DATA_GO_KR_KEY) {
      try {
        const aedUrl = `https://apis.data.go.kr/B552657/AEDInfoInqireService/getAedLcinfoInqire?serviceKey=${encodeURIComponent(window.DATA_GO_KR_KEY)}&WGS84_LON=${lon}&WGS84_LAT=${lat}&numOfRows=50&_type=json`;
        const res = await fetch(aedUrl);
        const resData = await res.json();
        const rawItems = resData?.response?.body?.items?.item || [];
        items = Array.isArray(rawItems) ? rawItems : [rawItems];
      } catch (e) {
        console.warn('AED Direct fetch warning:', e);
      }
    }

    if (items.length === 0) {
      // 서버 미응답 또는 독립 클라이언트 구동 시 위치 기반 기본 AED 데이터 제공
      items = [
        { rnum: '1', org: '주민센터', buildAddress: '인근 행정복지센터', buildPlace: '1층 민원실 입구 자동제세동기', wgs84Lat: lat + 0.00045, wgs84Lon: lon + 0.00030, serialSeq: '2021001', clerkTel: '02-120', model: 'CU-SP1', mfg: '씨유메디칼' },
        { rnum: '2', org: '지하철역', buildAddress: '지하철 역사', buildPlace: '개찰구 옆 고객안내센터 앞', wgs84Lat: lat - 0.00040, wgs84Lon: lon + 0.00065, serialSeq: '2022002', clerkTel: '1577-1234', model: 'HR-501', mfg: '라디안큐바이오' },
        { rnum: '3', org: '공공도서관', buildAddress: '문화복지센터', buildPlace: '중앙 로비 엘리베이터 앞', wgs84Lat: lat + 0.00085, wgs84Lon: lon - 0.00050, serialSeq: '2020003', clerkTel: '02-555-1199', model: 'HeartStart FRx', mfg: '필립스' }
      ];
    }

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
// 5. Google Maps 공식 마커 & 인터랙티브 스파이더파이어 시스템
// ==========================================================

// 기기 종류별 컴팩트 SVG 핀 아이콘 (지도 가림 방지 및 모던 애플/토스 디자인)
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
  const strokeWidth = isSelected ? 3.5 : (isNearest ? 3 : 2);
  const scale = isNearest || isSelected ? 1.15 : 1.0;

  const w = Math.round(36 * scale);
  const h = Math.round(46 * scale);

  const goldHalo = isNearest ? `<circle cx="18" cy="17" r="16" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="3,2" />` : '';

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 36 46">
    <defs>
      <filter id="p-sh-${item.id}" x="-30%" y="-20%" width="160%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.32"/>
      </filter>
    </defs>
    ${goldHalo}
    <!-- 핀 본체 -->
    <path d="M 18 2 C 9.5 2, 3 8.8, 3 17.5 C 3 28, 18 44, 18 44 C 18 44, 33 28, 33 17.5 C 33 8.8, 26.5 2, 18 2 Z"
          fill="${bgColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" filter="url(#p-sh-${item.id})" />
    <!-- 내부 흰색 원 -->
    <circle cx="18" cy="16.5" r="9.5" fill="#ffffff" />
    <!-- 이모지 아이콘 -->
    <text x="18" y="20.5" font-size="10.5" text-anchor="middle" font-family="'Apple Color Emoji','Segoe UI Emoji',sans-serif">${iconEmoji}</text>
    <!-- 명칭 알약 -->
    <rect x="5.5" y="30.5" width="25" height="10" rx="5" fill="${bgColor}" stroke="#ffffff" stroke-width="1" />
    <text x="18" y="38" font-size="7" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="'Pretendard', sans-serif">${catText}</text>
  </svg>`.trim();

  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(w, h),
    anchor: new google.maps.Point(w / 2, h - 2),
  };
}

// 복수 기기 밀집 클러스터 핀 아이콘 (밀집 수량 표기)
function createClusterPinIcon(cluster, isNearest) {
  const count = cluster.length;
  const hasAed = cluster.some(f => f.category === 'aed');
  const hasExt = cluster.some(f => f.category === 'extinguisher');
  const hasHyd = cluster.some(f => f.category === 'hydrant');

  let bgColor = '#7c3aed'; // 보라색 복합 클러스터
  let emoji = '🏢';
  if (hasAed && !hasExt && !hasHyd) {
    bgColor = '#ef4444';
    emoji = '⚡';
  } else if (!hasAed && hasExt && !hasHyd) {
    bgColor = '#f97316';
    emoji = '🧯';
  } else if (!hasAed && !hasExt && hasHyd) {
    bgColor = '#2563eb';
    emoji = '💧';
  }

  const w = 40;
  const h = 48;
  const strokeColor = isNearest ? '#f59e0b' : '#ffffff';

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 40 48">
    <defs>
      <filter id="c-sh" x="-30%" y="-20%" width="160%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <!-- 핀 본체 -->
    <path d="M 20 2 C 10 2, 3 9, 3 18 C 3 29, 20 46, 20 46 C 20 46, 37 29, 37 18 C 37 9, 30 2, 20 2 Z"
          fill="${bgColor}" stroke="${strokeColor}" stroke-width="${isNearest ? 3 : 2}" filter="url(#c-sh)" />
    <!-- 내부 흰색 디스크 -->
    <circle cx="20" cy="17" r="11" fill="#ffffff" />
    <!-- 이모지 심볼 -->
    <text x="20" y="21" font-size="11" text-anchor="middle" font-family="'Apple Color Emoji','Segoe UI Emoji',sans-serif">${emoji}</text>
    <!-- 밀집 수량 배지 -->
    <rect x="7" y="32" width="26" height="11" rx="5.5" fill="#0f172a" stroke="#ffffff" stroke-width="1.2" />
    <text x="20" y="40.5" font-size="7.5" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="'Pretendard', sans-serif">${count}대 밀집</text>
  </svg>`.trim();

  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(w, h),
    anchor: new google.maps.Point(w / 2, h - 2),
  };
}

// 사용자 현위치 레이더 펄스 핀 아이콘
function createUserLocationIcon() {
  const w = 36;
  const h = 46;
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 36 46">
    <defs>
      <filter id="u-sh" x="-30%" y="-20%" width="160%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
      </filter>
    </defs>
    <!-- 레이더 펄스 링 -->
    <circle cx="18" cy="17" r="15" fill="#3b82f6" fill-opacity="0.25" />
    <!-- 핀 본체 -->
    <path d="M 18 2 C 9.5 2, 3 8.8, 3 17.5 C 3 28, 18 44, 18 44 C 18 44, 33 28, 33 17.5 C 33 8.8, 26.5 2, 18 2 Z"
          fill="#1d4ed8" stroke="#ffffff" stroke-width="2" filter="url(#u-sh)" />
    <!-- 중앙 타겟 조준원 -->
    <circle cx="18" cy="16.5" r="9.5" fill="#ffffff" />
    <circle cx="18" cy="16.5" r="5" fill="#2563eb" />
    <circle cx="18" cy="16.5" r="2" fill="#ffffff" />
    <!-- 내 위치 라벨 -->
    <rect x="5.5" y="30.5" width="25" height="10" rx="5" fill="#1d4ed8" stroke="#ffffff" stroke-width="1" />
    <text x="18" y="38" font-size="6.8" font-weight="900" fill="#ffffff" text-anchor="middle" font-family="'Pretendard', sans-serif">내 위치</text>
  </svg>`.trim();

  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(w, h),
    anchor: new google.maps.Point(w / 2, h - 2),
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
        <button onclick="window.startInAppNavigation('${item.id}')" 
           style="flex: 1; text-align: center; background: #2563eb; color: #ffffff; border: none; padding: 7px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer;">
          🚶‍♂️ 도보 길안내 시작
        </button>
        <a href="tel:${item.clerkTel ? item.clerkTel.replace(/[^0-9]/g, '') : '119'}" 
           style="text-align: center; background: #fee2e2; color: #dc2626; padding: 7px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; text-decoration: none;">
          📞 통화
        </a>
      </div>
    </div>
  `;
}

// 26미터 이내 밀집 시설 물리적 거리 기반 클러스터링 알고리즘
function clusterFacilities(facilities) {
  const clusters = [];
  const assigned = new Set();
  const sorted = [...facilities].sort((a, b) => a.distanceMeters - b.distanceMeters);

  sorted.forEach((item) => {
    if (assigned.has(item.id)) return;
    const cluster = [item];
    assigned.add(item.id);

    sorted.forEach((other) => {
      if (assigned.has(other.id)) return;
      const d = calculateDistanceMeters(item.lat, item.lon, other.lat, other.lon);
      if (d <= 26) {
        cluster.push(other);
        assigned.add(other.id);
      }
    });

    clusters.push(cluster);
  });

  return clusters;
}

// 활성화된 스파이더파이어 접기 (원래 클러스터 핀으로 복귀)
function collapseSpider() {
  if (state.spiderMarkers && state.spiderMarkers.length > 0) {
    state.spiderMarkers.forEach(s => {
      if (s.marker) s.marker.setMap(null);
    });
    state.spiderMarkers = [];
  }
  if (state.spiderLines && state.spiderLines.length > 0) {
    state.spiderLines.forEach(l => l.setMap(null));
    state.spiderLines = [];
  }
  if (state.spiderCenterMarker) {
    state.spiderCenterMarker.setMap(null);
    state.spiderCenterMarker = null;
  }
  if (state.activeClusterMarker) {
    state.activeClusterMarker.setVisible(true);
    state.activeClusterMarker = null;
  }
  state.activeClusterId = null;
  if (elements.clusterSelectionModal) {
    elements.clusterSelectionModal.style.display = 'none';
  }
}

// 밀집 핀 터치 시 인터랙티브 스파이더파이어 방사 확장
function expandSpider(cluster, centerPos, clusterMarker) {
  if (!cluster || cluster.length <= 1) return;

  // 이미 이 클러스터가 열려있으면 접기 토글
  if (state.activeClusterMarker === clusterMarker) {
    collapseSpider();
    return;
  }

  collapseSpider();
  state.activeClusterMarker = clusterMarker;
  state.activeClusterId = cluster[0].id;
  clusterMarker.setVisible(false); // 확장 중에는 중심 클러스터 핀 숨김

  // 중심점에 앵커 서클 마커 배치
  state.spiderCenterMarker = new google.maps.Marker({
    position: centerPos,
    map: state.map,
    zIndex: 200,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 5,
      fillColor: '#3b82f6',
      fillOpacity: 0.9,
      strokeColor: '#ffffff',
      strokeWeight: 2,
    },
    title: '밀집 시설 위치',
  });

  const count = cluster.length;
  // 방사 거리: 약 36미터 (터치 간격 넉넉히 확보)
  const radiusDeg = 0.00033;
  const latCos = Math.max(0.1, Math.cos(centerPos.lat * Math.PI / 180));

  cluster.forEach((item, index) => {
    let angle;
    if (count === 2) {
      // 2개일 때는 대각선(10시 / 4시 방향)으로 자연스럽게 분산
      angle = (index === 0) ? (-3 * Math.PI / 4) : (Math.PI / 4);
    } else {
      // 3개 이상일 때는 12시 방향부터 시계방향 등간격 원형 배치
      angle = (2 * Math.PI * index) / count - (Math.PI / 2);
    }

    const sLat = centerPos.lat + radiusDeg * Math.cos(angle);
    const sLon = centerPos.lng + (radiusDeg * Math.sin(angle)) / latCos;
    const spiderPos = { lat: sLat, lng: sLon };

    // 거미줄 연결선 (Polyline)
    const legLine = new google.maps.Polyline({
      path: [centerPos, spiderPos],
      strokeColor: '#3b82f6',
      strokeOpacity: 0.8,
      strokeWeight: 2.2,
      geodesic: true,
      map: state.map,
    });
    state.spiderLines.push(legLine);

    // 방사형으로 펼쳐진 개별 안전시설 핀
    const isSelected = state.selectedFacilityId === item.id;
    const spiderPin = new google.maps.Marker({
      position: spiderPos,
      map: state.map,
      title: `[${item.categoryName}] ${item.name} (${item.distanceMeters}m)`,
      zIndex: isSelected ? 600 : 500,
      icon: createCustomPinIcon(item, item.isNearest, isSelected),
      animation: google.maps.Animation.DROP,
    });

    const infoWindow = new google.maps.InfoWindow({
      content: createInfoWindowContent(item, item.isNearest),
    });

    spiderPin.addListener('click', () => {
      // 핀 클릭 시 스파이더를 닫지 않고 해당 기기를 선택하여 인포윈도우 오픈
      selectFacility(item, false);
    });

    state.spiderMarkers.push({ marker: spiderPin, infoWindow, item, spiderPos });
  });

  // 상단 밀집 시설 퀵 선택 플로팅 카드 노출
  if (elements.clusterSelectionModal && elements.clusterItemsContainer) {
    const locTitle = cluster[0].org || cluster[0].buildAddress || '해당 위치';
    elements.clusterTitle.textContent = `${locTitle} (${cluster.length}대 밀집)`;
    elements.clusterItemsContainer.innerHTML = '';

    cluster.forEach(item => {
      const card = document.createElement('div');
      const isSelected = state.selectedFacilityId === item.id;
      card.className = `cluster-item-card ${isSelected ? 'selected' : ''}`;
      card.dataset.id = item.id;

      let catIcon = '⚡';
      if (item.category === 'extinguisher') catIcon = '🧯';
      if (item.category === 'hydrant') catIcon = '💧';

      card.innerHTML = `
        <div class="cluster-item-left">
          <div class="cluster-item-name">${catIcon} ${item.name}</div>
          <div class="cluster-item-place">🏢 ${item.buildPlace || item.buildAddress || '위치 정보 없음'}</div>
        </div>
        <div class="cluster-item-right">
          <span class="cluster-item-dist">${item.distanceMeters}m</span>
          <span class="cluster-item-btn">${isSelected ? '선택됨' : '선택'}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        selectFacility(item, false);
      });

      elements.clusterItemsContainer.appendChild(card);
    });

    elements.clusterSelectionModal.style.display = 'flex';
  }

  showStatus(`🏢 밀집 시설 ${cluster.length}대가 펼쳐졌습니다. 핀이나 목록을 터치해 선택하세요.`, 2200);
}

function clearMarkers() {
  collapseSpider();
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

  // 2. 26m 이내 밀집 시설 물리적 거리 기반 클러스터링
  const clusters = clusterFacilities(state.facilities);

  clusters.forEach((cluster) => {
    if (cluster.length === 1) {
      // 단일 시설: 실제 정위치에 일반 핀 생성
      const item = cluster[0];
      const isNearest = item.isNearest;
      const isSelected = state.selectedFacilityId ? (state.selectedFacilityId === item.id) : isNearest;

      const marker = new google.maps.Marker({
        position: { lat: item.lat, lng: item.lon },
        map: state.map,
        title: `[${item.categoryName}] ${item.name} (${item.distanceMeters}m)`,
        zIndex: isNearest ? 100 : 50,
        icon: createCustomPinIcon(item, isNearest, isSelected),
      });

      const infoWindow = new google.maps.InfoWindow({
        content: createInfoWindowContent(item, isNearest),
      });

      marker.addListener('click', () => {
        collapseSpider();
        selectFacility(item, false);
      });

      state.markers.push(marker);
      state.markersMap.set(item.id, { marker, infoWindow, item, isCluster: false });
    } else {
      // 복수 시설 (밀집): 중심점에 클러스터 핀 생성 (터치 시 스파이더파이어 방사 확장)
      const isNearest = cluster.some(f => f.isNearest);
      const centerLat = cluster.reduce((sum, f) => sum + f.lat, 0) / cluster.length;
      const centerLon = cluster.reduce((sum, f) => sum + f.lon, 0) / cluster.length;
      const centerPos = { lat: centerLat, lng: centerLon };

      const clusterMarker = new google.maps.Marker({
        position: centerPos,
        map: state.map,
        title: `${cluster.length}개 안전시설 밀집 (터치하여 펼치기)`,
        zIndex: isNearest ? 150 : 80,
        icon: createClusterPinIcon(cluster, isNearest),
      });

      clusterMarker.addListener('click', () => {
        expandSpider(cluster, centerPos, clusterMarker);
      });

      state.markers.push(clusterMarker);

      // 클러스터 소속 개별 시설 등록
      cluster.forEach(item => {
        const infoWindow = new google.maps.InfoWindow({
          content: createInfoWindowContent(item, item.isNearest),
        });
        state.markersMap.set(item.id, {
          marker: clusterMarker,
          infoWindow,
          item,
          isCluster: true,
          cluster,
          centerPos
        });
      });
    }
  });

  // 3. 최단거리(또는 현재 선택된 시설) 유도선 (Polyline)
  const targetItem = (state.selectedFacilityId && state.facilities.find(f => f.id === state.selectedFacilityId)) || state.nearestFacility;
  if (targetItem) {
    state.routePolyline = new google.maps.Polyline({
      path: [userPos, { lat: targetItem.lat, lng: targetItem.lon }],
      strokeColor: '#f59e0b',
      strokeOpacity: 0.9,
      strokeWeight: 4,
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

  const markerObj = state.markersMap.get(item.id);

  if (markerObj && markerObj.isCluster) {
    // 밀집 시설에 속한 경우
    if (state.activeClusterMarker !== markerObj.marker) {
      // 해당 클러스터 스파이더가 아직 안 열려 있다면 펼치기
      expandSpider(markerObj.cluster, markerObj.centerPos, markerObj.marker);
    }

    // 펼쳐진 스파이더 마커 중 해당 기기 마커 탐색
    const spiderObj = state.spiderMarkers.find(s => s.item.id === item.id);
    if (spiderObj) {
      if (state.currentInfoWindow) {
        state.currentInfoWindow.close();
      }
      spiderObj.marker.setZIndex(9999);
      spiderObj.infoWindow.open(state.map, spiderObj.marker);
      state.currentInfoWindow = spiderObj.infoWindow;

      if (state.map) {
        state.map.panTo(spiderObj.marker.getPosition());
      }
    }

    // 스파이더 핀 선택 아이콘 강조 갱신
    state.spiderMarkers.forEach(s => {
      const isThisSelected = s.item.id === item.id;
      s.marker.setIcon(createCustomPinIcon(s.item, s.item.isNearest, isThisSelected));
      s.marker.setZIndex(isThisSelected ? 9999 : 500);
    });

    // 클러스터 팝업 모달 내 선택 스타일 동기화
    if (elements.clusterItemsContainer) {
      elements.clusterItemsContainer.querySelectorAll('.cluster-item-card').forEach(c => {
        const isMatch = c.dataset.id === item.id;
        c.classList.toggle('selected', isMatch);
        const btn = c.querySelector('.cluster-item-btn');
        if (btn) btn.textContent = isMatch ? '선택됨' : '선택';
      });
    }
  } else if (markerObj) {
    // 단일 시설인 경우: 스파이더 접고 해당 핀으로 포커스
    collapseSpider();

    if (state.map) {
      state.map.panTo({ lat: item.lat, lng: item.lon });
      if (state.map.getZoom() < 17) {
        state.map.setZoom(17);
      }
    }

    if (state.currentInfoWindow) {
      state.currentInfoWindow.close();
    }
    markerObj.marker.setZIndex(9999);
    markerObj.infoWindow.open(state.map, markerObj.marker);
    state.currentInfoWindow = markerObj.infoWindow;

    if (markerObj.marker.setAnimation) {
      markerObj.marker.setAnimation(google.maps.Animation.BOUNCE);
      setTimeout(() => {
        if (markerObj.marker) markerObj.marker.setAnimation(null);
      }, 1400);
    }
  }

  // 유도선(Polyline) 갱신 (실제 건물/시설 좌표로 연결)
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
      strokeWeight: 4,
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
    startInAppNavigation(item.id);
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
          ${item.isRealRoad ? '<span style="font-size: 9.5px; font-weight: 800; color: #2563eb; background: #eff6ff; padding: 1.5px 5px; border-radius: 4px;">🚶 도보 실거리</span>' : ''}
          ${isGolden ? '<span class="card-golden-pill">골든타임 4분 내</span>' : ''}
        </div>
      </div>
      <div class="card-arrow-action">
        <button class="btn-card-nav" style="background: #2563eb; color: #ffffff; border: none; border-radius: 8px; padding: 6px 10px; font-size: 11px; font-weight: 800; cursor: pointer; white-space: nowrap;">
          길안내 ➔
        </button>
      </div>
    `;

    const navBtn = card.querySelector('.btn-card-nav');
    if (navBtn) {
      navBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startInAppNavigation(item.id);
      });
    }

    card.addEventListener('click', () => {
      selectFacility(item, true);
    });

    elements.facilityList.appendChild(card);
  });
}

// ==========================================================
// 6-1. 도보 실거리 매트릭스 & 실시간 인앱 길안내 엔진
// ==========================================================
let currentNavRoutePolyline = null;
let currentNavRouteOutline = null;
let navGpsWatchId = null;
let currentNavFacility = null;
let currentNavSteps = [];

// 주변 시설들의 실제 도로망 기반 도보 거리 계산 및 최단거리 순위 재정렬
async function updateFacilitiesRealWalkingDistances() {
  if (!state.facilities || state.facilities.length === 0) return;

  const topCandidates = state.facilities.slice(0, 15);
  try {
    let data = null;
    try {
      const resp = await fetch('/api/routes/matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: state.userLat, lon: state.userLon },
          destinations: topCandidates.map(f => ({ id: f.id, lat: f.lat, lon: f.lon })),
        }),
        signal: AbortSignal.timeout(4500),
      });
      if (resp.ok) data = await resp.json();
    } catch (e) {
      console.warn('Matrix API fetch warning:', e.message);
    }

    // 클라이언트 직접 폴백
    if (!data || !data.success) {
      const oLat = state.userLat;
      const oLon = state.userLon;
      const coordsStr = `${oLon},${oLat};` + topCandidates.map(t => `${t.lon},${t.lat}`).join(';');
      const clientUrl = `https://routing.openstreetmap.de/routed-foot/table/v1/driving/${coordsStr}?sources=0&annotations=distance,duration`;
      const clientResp = await fetch(clientUrl, { signal: AbortSignal.timeout(4000) });
      if (clientResp.ok) {
        const osrmData = await clientResp.json();
        if (osrmData.code === 'Ok' && osrmData.distances && osrmData.distances[0]) {
          data = {
            success: true,
            results: topCandidates.map((t, idx) => {
              const d = Math.round(osrmData.distances[0][idx + 1] || calculateDistanceMeters(oLat, oLon, t.lat, t.lon) * 1.25);
              const dur = Math.round(osrmData.durations[0][idx + 1] || d / 1.25);
              return {
                id: t.id,
                distanceMeters: d,
                durationSeconds: dur,
                walkingTimeText: getWalkingTimeText(d),
                isRealRoad: true,
              };
            }),
          };
        }
      }
    }

    if (data && data.success && Array.isArray(data.results)) {
      const matrixMap = new Map();
      data.results.forEach(r => matrixMap.set(r.id, r));

      state.facilities.forEach(f => {
        const m = matrixMap.get(f.id);
        if (m) {
          f.distanceMeters = m.distanceMeters;
          f.walkingTime = m.walkingTimeText;
          f.isRealRoad = m.isRealRoad;
        }
      });

      // 실제 도보 실거리 기준으로 재정렬
      state.facilities.sort((a, b) => a.distanceMeters - b.distanceMeters);
      state.facilities.forEach((f, idx) => f.isNearest = (idx === 0));
      state.nearestFacility = state.facilities[0];

      // UI 및 랭킹 리스트 동기화
      if (state.selectedFacilityId) {
        const selected = state.facilities.find(f => f.id === state.selectedFacilityId);
        if (selected) updateNearestCard(selected);
      } else {
        updateNearestCard(state.nearestFacility);
      }
      renderFacilityList(state.facilities);
    }
  } catch (e) {
    console.warn('Real walking distance calculation warning:', e);
  }
}

// 실시간 인앱 도보 길찾기 시작
async function startInAppNavigation(facilityId) {
  const facility = state.facilities.find(f => f.id === facilityId) || (state.nearestFacility && state.nearestFacility.id === facilityId ? state.nearestFacility : null);
  if (!facility) {
    showStatus('길안내할 안전시설을 찾을 수 없습니다.', 2000);
    return;
  }

  currentNavFacility = facility;
  showStatus(`🚶‍♂️ '${facility.name}' 도보 경로를 탐색하고 있습니다...`, 2500);

  // 하단 기본 시트 접기 & 스파이더 접기
  toggleBottomSheet(true);
  collapseSpider();

  // 인앱 내비게이션 패널 UI 초기화
  elements.inAppNavPanel.style.display = 'flex';
  elements.navDestName.textContent = `[${facility.categoryName}] ${facility.name}`;
  elements.navDestPlace.textContent = `🏢 ${facility.buildPlace || facility.buildAddress || '위치 정보 없음'}`;
  elements.navRealDistance.textContent = `${facility.distanceMeters}`;
  elements.navRealDuration.textContent = facility.walkingTime;
  elements.navStepIcon.textContent = '⏳';
  elements.navStepMain.textContent = '실제 도로망 기반 도보 경로 계산 중...';
  elements.navStepSub.textContent = '안전한 보행로를 찾는 중입니다.';

  try {
    let routeData = null;
    try {
      const resp = await fetch('/api/routes/directions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: state.userLat, lon: state.userLon },
          destination: { lat: facility.lat, lon: facility.lon },
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (resp.ok) routeData = await resp.json();
    } catch (e) {
      console.warn('Backend directions fetch error, attempting direct client fallback:', e);
    }

    // 클라이언트 직접 폴백
    if (!routeData || !routeData.success) {
      const oLat = state.userLat;
      const oLon = state.userLon;
      const dLat = facility.lat;
      const dLon = facility.lon;
      const clientUrl = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${oLon},${oLat};${dLon},${dLat}?overview=full&geometries=geojson&steps=true`;
      const clientResp = await fetch(clientUrl, { signal: AbortSignal.timeout(5000) });
      if (clientResp.ok) {
        const osrmData = await clientResp.json();
        if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes[0]) {
          const r = osrmData.routes[0];
          routeData = {
            success: true,
            distanceMeters: Math.round(r.distance),
            durationSeconds: Math.round(r.duration),
            walkingTimeText: getWalkingTimeText(Math.round(r.distance)),
            coordinates: r.geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] })),
            steps: parseOsrmSteps(r.legs[0].steps),
          };
        }
      }
    }

    if (routeData && routeData.success && routeData.coordinates && routeData.coordinates.length > 0) {
      renderInAppNavigationRoute(routeData, facility);
      showStatus(`🏁 도보 경로 탐색 완료 (${routeData.distanceMeters}m / ${routeData.walkingTimeText})`, 2500);
    } else {
      throw new Error('경로 데이터 생성 실패');
    }
  } catch (err) {
    console.error('In-app navigation error:', err);
    showStatus('도보 경로 탐색 실패: 직선 경로로 대체 안내합니다.', 2500);
    const fallbackCoords = [
      { lat: state.userLat, lng: state.userLon },
      { lat: facility.lat, lng: facility.lon }
    ];
    renderInAppNavigationRoute({
      distanceMeters: facility.distanceMeters,
      walkingTimeText: facility.walkingTime,
      coordinates: fallbackCoords,
      steps: [
        { stepIndex: 1, icon: '🚶', instruction: '출발지에서 목적지 방향으로 직진', distanceMeters: facility.distanceMeters },
        { stepIndex: 2, icon: '🎯', instruction: '목적지 건물 도착', distanceMeters: 0 }
      ]
    }, facility);
  }

  // 실시간 GPS 추적 시작
  startNavGpsTracking();
}

// OSRM 스텝 한글화 파서
function parseOsrmSteps(rawSteps) {
  if (!rawSteps || !Array.isArray(rawSteps)) return [];
  return rawSteps.map((s, idx) => {
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
}

// 인앱 도보 경로 지도 렌더링
function renderInAppNavigationRoute(routeData, facility) {
  if (!state.map) return;

  if (currentNavRoutePolyline) currentNavRoutePolyline.setMap(null);
  if (currentNavRouteOutline) currentNavRouteOutline.setMap(null);
  if (state.routePolyline) state.routePolyline.setMap(null);

  // 1. 고대비 도보 경로선 렌더링
  currentNavRouteOutline = new google.maps.Polyline({
    path: routeData.coordinates,
    strokeColor: '#1e3a8a',
    strokeOpacity: 0.95,
    strokeWeight: 7,
    geodesic: true,
    map: state.map,
    zIndex: 300,
  });

  currentNavRoutePolyline = new google.maps.Polyline({
    path: routeData.coordinates,
    strokeColor: '#38bdf8',
    strokeOpacity: 1.0,
    strokeWeight: 4,
    geodesic: true,
    map: state.map,
    zIndex: 301,
  });

  // 2. 전체 경로 화면 맞춤 줌
  const bounds = new google.maps.LatLngBounds();
  routeData.coordinates.forEach(pt => bounds.extend(pt));
  bounds.extend({ lat: state.userLat, lng: state.userLon });
  bounds.extend({ lat: facility.lat, lng: facility.lon });
  state.map.fitBounds(bounds, { top: 140, bottom: 240, left: 40, right: 40 });

  // 3. UI 지표 및 스텝 업데이트
  elements.navRealDistance.textContent = `${routeData.distanceMeters}`;
  elements.navRealDuration.textContent = routeData.walkingTimeText;

  currentNavSteps = routeData.steps || [];
  if (currentNavSteps.length > 0) {
    const firstStep = currentNavSteps[0];
    elements.navStepIcon.textContent = firstStep.icon || '🚶';
    elements.navStepMain.textContent = firstStep.instruction;
    elements.navStepSub.textContent = `구간 거리 약 ${firstStep.distanceMeters}m`;

    if (elements.navStepsList) {
      elements.navStepsList.innerHTML = '';
      currentNavSteps.forEach((s, idx) => {
        const stepRow = document.createElement('div');
        stepRow.className = `nav-step-item ${idx === 0 ? 'active' : ''}`;
        stepRow.innerHTML = `
          <span class="step-num">${s.stepIndex || idx + 1}</span>
          <span class="step-glyph">${s.icon || '🚶'}</span>
          <div class="step-detail">
            <div class="step-desc">${s.instruction}</div>
            <div class="step-dist">${s.distanceMeters > 0 ? s.distanceMeters + 'm' : '도착'}</div>
          </div>
        `;
        elements.navStepsList.appendChild(stepRow);
      });
      if (elements.toggleStepsText) {
        elements.toggleStepsText.textContent = `전체 경로 ${currentNavSteps.length}단계 보기 ▼`;
      }
    }
  }
}

// 실시간 내비게이션 GPS 추적
function startNavGpsTracking() {
  if (!navigator.geolocation) return;
  if (navGpsWatchId !== null) navigator.geolocation.clearWatch(navGpsWatchId);

  navGpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      state.userLat = pos.coords.latitude;
      state.userLon = pos.coords.longitude;
      if (state.userMarker) {
        state.userMarker.setPosition({ lat: state.userLat, lng: state.userLon });
      }

      if (currentNavFacility) {
        const remainingDist = calculateDistanceMeters(state.userLat, state.userLon, currentNavFacility.lat, currentNavFacility.lon);
        elements.navRealDistance.textContent = `${remainingDist}`;
        elements.navRealDuration.textContent = getWalkingTimeText(remainingDist);

        if (remainingDist <= 15) {
          elements.navStepIcon.textContent = '🎯';
          elements.navStepMain.textContent = '목적지 주변 도착! 건물 내부로 진입하세요.';
          elements.navStepSub.textContent = `🏢 ${currentNavFacility.buildPlace || '상세 설치 위치'}`;
          showStatus('🎉 목적지 주변에 도착했습니다!', 4000);
        }
      }
    },
    (err) => console.warn('Nav GPS watch warning:', err),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
  );
}

// 인앱 도보 길찾기 종료
function stopInAppNavigation() {
  if (navGpsWatchId !== null) {
    navigator.geolocation.clearWatch(navGpsWatchId);
    navGpsWatchId = null;
  }
  if (currentNavRoutePolyline) {
    currentNavRoutePolyline.setMap(null);
    currentNavRoutePolyline = null;
  }
  if (currentNavRouteOutline) {
    currentNavRouteOutline.setMap(null);
    currentNavRouteOutline = null;
  }
  if (elements.inAppNavPanel) {
    elements.inAppNavPanel.style.display = 'none';
  }
  currentNavFacility = null;
  currentNavSteps = [];
  toggleBottomSheet(false);

  if (state.selectedFacilityId) {
    const item = state.facilities.find(f => f.id === state.selectedFacilityId);
    if (item) selectFacility(item, false);
  }
  showStatus('도보 길안내가 종료되었습니다.', 1800);
}

// 글로벌 등록 (인포윈도우 등 인라인 onclick 호출 지원)
window.startInAppNavigation = startInAppNavigation;
window.stopInAppNavigation = stopInAppNavigation;

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

// 실제 GPS 위치로 이동 (헤더 버튼 & 플로팅 버튼 공통)
function moveToRealGps() {
  showStatus('🛰️ 실제 GPS 현위치 수신 중...');
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.userLat = pos.coords.latitude;
        state.userLon = pos.coords.longitude;
        if (state.map) {
          state.map.panTo({ lat: state.userLat, lng: state.userLon });
          state.map.setZoom(17);
        }
        if (elements.locationSearchInput) {
          elements.locationSearchInput.value = '';
          if (elements.btnClearSearch) elements.btnClearSearch.style.display = 'none';
        }
        showStatus('📍 실제 GPS 현위치로 이동 완료', 2200);
        fetchFacilities();
      },
      (err) => {
        console.warn('GPS error:', err);
        showStatus('GPS 위치 수신 실패: 기기의 위치 권한을 확인해 주세요.', 3000);
      },
      { timeout: 7000, enableHighAccuracy: true, maximumAge: 0 }
    );
  } else {
    showStatus('현재 브라우저/기기가 GPS 위치 서비스를 지원하지 않습니다.', 2500);
  }
}

// 장소/도로명/역명 검색으로 내 기준 위치 이동
function searchAndMoveLocation(query) {
  if (!query || !query.trim()) {
    showStatus('검색할 장소나 도로명을 입력해 주세요.', 2000);
    return;
  }
  const q = query.trim();
  showStatus(`🔍 '${q}' 위치 검색 중...`);

  const presetLocations = {
    '서울시청': { lat: 37.5665, lon: 126.9780, name: '서울특별시청' },
    '시청역': { lat: 37.5657, lon: 126.9769, name: '시청역 (1·2호선)' },
    '광화문': { lat: 37.5714, lon: 126.9769, name: '광화문 세종대로' },
    '강남역': { lat: 37.4979, lon: 127.0276, name: '강남역' },
    '홍대입구역': { lat: 37.5575, lon: 126.9245, name: '홍대입구역' },
    '여의도': { lat: 37.5216, lon: 126.9242, name: '여의도' },
    '잠실역': { lat: 37.5133, lon: 127.1001, name: '잠실역' },
    '종로': { lat: 37.5704, lon: 126.9922, name: '종로' },
    '명동': { lat: 37.5636, lon: 126.9834, name: '명동' },
  };

  const foundPreset = Object.entries(presetLocations).find(([k]) => q.includes(k) || k.includes(q));

  if (window.google && google.maps && google.maps.Geocoder) {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: q, region: 'KR' }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        state.userLat = loc.lat();
        state.userLon = loc.lng();

        if (state.map) {
          state.map.panTo({ lat: state.userLat, lng: state.userLon });
          state.map.setZoom(17);
        }

        showStatus(`📍 ${results[0].formatted_address} 기준 안전시설 탐색`, 2500);
        fetchFacilities();
      } else if (foundPreset) {
        state.userLat = foundPreset[1].lat;
        state.userLon = foundPreset[1].lon;
        if (state.map) {
          state.map.panTo({ lat: state.userLat, lng: state.userLon });
          state.map.setZoom(17);
        }
        showStatus(`📍 '${foundPreset[1].name}' 기준 안전시설 탐색`, 2500);
        fetchFacilities();
      } else {
        showStatus(`'${q}' 검색 결과를 찾을 수 없습니다. 도로명이나 역명을 입력해 보세요.`, 3000);
      }
    });
  } else if (foundPreset) {
    state.userLat = foundPreset[1].lat;
    state.userLon = foundPreset[1].lon;
    if (state.map) {
      state.map.panTo({ lat: state.userLat, lng: state.userLon });
      state.map.setZoom(17);
    }
    showStatus(`📍 '${foundPreset[1].name}' 기준 안전시설 탐색`, 2500);
    fetchFacilities();
  } else {
    showStatus(`'${q}' 검색에 실패했습니다. 다른 키워드로 검색해 주세요.`, 2500);
  }
}

// ==========================================================
// 8. 이벤트 바인딩
// ==========================================================
function bindEvents() {
  // 위치 검색 실행 리스너
  const executeSearch = () => {
    if (elements.locationSearchInput) {
      searchAndMoveLocation(elements.locationSearchInput.value);
    }
  };

  if (elements.btnSearchLocation) {
    elements.btnSearchLocation.addEventListener('click', executeSearch);
  }

  if (elements.locationSearchInput) {
    elements.locationSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSearch();
      }
    });

    elements.locationSearchInput.addEventListener('input', (e) => {
      if (elements.btnClearSearch) {
        elements.btnClearSearch.style.display = e.target.value.trim() ? 'flex' : 'none';
      }
    });
  }

  if (elements.btnClearSearch) {
    elements.btnClearSearch.addEventListener('click', () => {
      if (elements.locationSearchInput) {
        elements.locationSearchInput.value = '';
        elements.locationSearchInput.focus();
      }
      elements.btnClearSearch.style.display = 'none';
    });
  }

  // 실제 GPS 위치로 이동 (헤더 버튼 및 플로팅 FAB 공통 바인딩)
  if (elements.btnGpsDirect) {
    elements.btnGpsDirect.addEventListener('click', moveToRealGps);
  }
  if (elements.btnCurrentLocation) {
    elements.btnCurrentLocation.addEventListener('click', moveToRealGps);
  }

  // 밀집 시설 팝업 닫기 버튼
  if (elements.btnCloseClusterModal) {
    elements.btnCloseClusterModal.addEventListener('click', () => {
      collapseSpider();
    });
  }

  // 실시간 인앱 도보 내비게이션 컨트롤 바인딩
  if (elements.btnCloseNav) {
    elements.btnCloseNav.addEventListener('click', stopInAppNavigation);
  }

  if (elements.btnToggleSteps) {
    elements.btnToggleSteps.addEventListener('click', () => {
      const isHidden = elements.navStepsList.style.display === 'none';
      elements.navStepsList.style.display = isHidden ? 'flex' : 'none';
      if (elements.toggleStepsText) {
        elements.toggleStepsText.textContent = isHidden
          ? `전체 경로 ${currentNavSteps.length}단계 접기 ▲`
          : `전체 경로 ${currentNavSteps.length}단계 보기 ▼`;
      }
    });
  }

  if (elements.btnFollowNavGps) {
    elements.btnFollowNavGps.addEventListener('click', () => {
      if (state.map) {
        state.map.panTo({ lat: state.userLat, lng: state.userLon });
        state.map.setZoom(18);
      }
      showStatus('📍 내 현재 위치로 화면을 맞췄습니다.', 1500);
    });
  }

  if (elements.btnFitNavRoute) {
    elements.btnFitNavRoute.addEventListener('click', () => {
      if (currentNavRoutePolyline && state.map) {
        const bounds = new google.maps.LatLngBounds();
        currentNavRoutePolyline.getPath().forEach(pt => bounds.extend(pt));
        state.map.fitBounds(bounds, { top: 140, bottom: 240, left: 40, right: 40 });
      }
    });
  }

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
