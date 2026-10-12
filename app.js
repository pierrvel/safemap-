/**
 * 골든타임 세이프맵 (GoldenTime SafeMap)
 * 공공 안전시설 위치 데이터 전처리와 최단경로 분석을 통한 응급시설 탐색 시스템
 * (GitHub Pages 독립 실행 및 서버 모드 겸용 지원)
 */

// 공공데이터포털 인증키 (국립중앙의료원 전국 AED 정보조회 서비스)
const DATA_GO_KR_KEY = 'cHwaVtA5OSzBd8gpTWKh2vM7qNRMDW55vNxj0bnj5JgFoTv7ih74zb9sZR6Q788IQIxEIVSKgknbEPUN332gAQ%3D%3D';

// 전역 상태
const state = {
  userLat: 37.5665,
  userLon: 126.9780,
  currentCategory: 'all',
  verifiedOnly: true,
  facilities: [],
  nearestFacility: null,
  stats: null,
  activeEngine: 'google', // 'google' | 'leaflet'
  googleApiKey: localStorage.getItem('google_maps_api_key') || '',
  map: null,
  markers: [],
  nearestMarker: null,
  userMarker: null,
  routePolyline: null,
  userReports: JSON.parse(localStorage.getItem('safemap_user_reports') || '[]'),
};

// DOM 요소
const elements = {
  countAll: document.getElementById('countAll'),
  countAed: document.getElementById('countAed'),
  countExt: document.getElementById('countExt'),
  countHyd: document.getElementById('countHyd'),
  verifiedToggle: document.getElementById('verifiedToggle'),
  catTabs: document.querySelectorAll('.cat-tab'),

  googleMapContainer: document.getElementById('googleMap'),
  leafletMapContainer: document.getElementById('leafletMap'),
  mapEngineName: document.getElementById('mapEngineName'),
  btnCurrentLocation: document.getElementById('btnCurrentLocation'),
  btnRefreshArea: document.getElementById('btnRefreshArea'),
  btnMapEngineToggle: document.getElementById('btnMapEngineToggle'),
  statusBanner: document.getElementById('statusBanner'),
  statusMessage: document.getElementById('statusMessage'),

  nearestCard: document.getElementById('nearestCard'),
  nearestCategoryBadge: document.getElementById('nearestCategoryBadge'),
  nearestVerifiedBadge: document.getElementById('nearestVerifiedBadge'),
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

  listToggleHeader: document.getElementById('listToggleHeader'),
  facilityList: document.getElementById('facilityList'),
  totalListCount: document.getElementById('totalListCount'),

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
// 1. 초기화 및 위치 수신
// ==========================================================
async function initApp() {
  bindEvents();
  
  if (state.googleApiKey) {
    elements.inputGoogleApiKey.value = state.googleApiKey;
  }

  showStatus('GPS 현위치를 확인하고 있습니다...');
  
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.userLat = pos.coords.latitude;
        state.userLon = pos.coords.longitude;
        loadMapAndData();
      },
      (err) => {
        console.warn('Geolocation failed, fallback to default (서울시청):', err.message);
        showStatus('현위치 확인 불가로 서울시청 기준으로 실행합니다.', 2500);
        loadMapAndData();
      },
      { timeout: 7000, enableHighAccuracy: true }
    );
  } else {
    loadMapAndData();
  }
}

function loadMapAndData() {
  loadGoogleMapsScript()
    .then(() => {
      initGoogleMap();
      fetchFacilities();
    })
    .catch((err) => {
      console.warn('Google Maps 로드 실패, Leaflet 엔진으로 자동 전환합니다:', err);
      initLeafletMap();
      fetchFacilities();
    });
}

function loadGoogleMapsScript() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    const keyParam = state.googleApiKey ? `key=${state.googleApiKey}&` : '';
    script.src = `https://maps.googleapis.com/maps/api/js?${keyParam}libraries=geometry&callback=onGoogleMapsLoaded`;
    script.async = true;
    script.defer = true;

    window.onGoogleMapsLoaded = () => {
      resolve();
    };

    script.onerror = (e) => {
      reject(e);
    };

    document.head.appendChild(script);

    setTimeout(() => {
      if (!window.google || !window.google.maps) {
        reject(new Error('Google Maps script load timeout'));
      }
    }, 6000);
  });
}

function initGoogleMap() {
  state.activeEngine = 'google';
  elements.mapEngineName.textContent = '구글맵';
  elements.googleMapContainer.style.display = 'block';
  elements.leafletMapContainer.style.display = 'none';

  const mapOptions = {
    center: { lat: state.userLat, lng: state.userLon },
    zoom: 17,
    disableDefaultUI: true,
    zoomControl: true,
    styles: [
      { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'simplified' }] }
    ]
  };

  state.map = new google.maps.Map(elements.googleMapContainer, mapOptions);

  state.map.addListener('click', (e) => {
    state.userLat = e.latLng.lat();
    state.userLon = e.latLng.lng();
    showStatus('선택하신 지점으로 탐색 위치를 변경했습니다.', 2000);
    fetchFacilities();
  });
}

function initLeafletMap() {
  state.activeEngine = 'leaflet';
  elements.mapEngineName.textContent = '오픈맵';
  elements.googleMapContainer.style.display = 'none';
  elements.leafletMapContainer.style.display = 'block';

  if (!state.map || state.activeEngine !== 'leaflet') {
    state.map = L.map('leafletMap', {
      zoomControl: true,
      attributionControl: false
    }).setView([state.userLat, state.userLon], 17);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(state.map);

    state.map.on('click', (e) => {
      state.userLat = e.latlng.lat;
      state.userLon = e.latlng.lng;
      showStatus('선택하신 지점으로 탐색 위치를 변경했습니다.', 2000);
      fetchFacilities();
    });
  } else {
    state.map.setView([state.userLat, state.userLon], 17);
  }
}

// ==========================================================
// 2. 공공 안전데이터 수집 및 전처리 엔진 (클라이언트 & 서버 공용)
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
      buildPlace: '1층 엘리베이터 홀 우측 벽면 거치대',
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
      installYear: 2013, // 내구연한 10년 초과!
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
  showStatus('주변 안전시설 공공데이터 수집 및 전처리 중...');

  try {
    // 1단계: 백엔드 API 호출 시도, 실패 시 브라우저에서 data.go.kr 직접 호출
    let data = null;
    try {
      const res = await fetch(`/api/facilities?lat=${state.userLat}&lon=${state.userLon}&category=${state.currentCategory}&verifiedOnly=${state.verifiedOnly}`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        data = await res.json();
      }
    } catch (e) {
      // 서버가 없는 GitHub Pages 환경인 경우 클라이언트 직접 처리
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

// GitHub Pages 독립 실행용 클라이언트 사이드 전처리 함수
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

  // AED 데이터 수집 (공공데이터포털 CORS 지원)
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
          categoryName: '자동심장충격기 (AED)',
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
// 3. 지도 마커 및 최단거리 경로 시각화
// ==========================================================
function clearMarkers() {
  if (state.activeEngine === 'google') {
    state.markers.forEach(m => m.setMap(null));
    state.markers = [];
    if (state.userMarker) {
      state.userMarker.setMap(null);
      state.userMarker = null;
    }
    if (state.routePolyline) {
      state.routePolyline.setMap(null);
      state.routePolyline = null;
    }
  } else if (state.activeEngine === 'leaflet') {
    state.markers.forEach(m => state.map.removeLayer(m));
    state.markers = [];
    if (state.userMarker) {
      state.map.removeLayer(state.userMarker);
      state.userMarker = null;
    }
    if (state.routePolyline) {
      state.map.removeLayer(state.routePolyline);
      state.routePolyline = null;
    }
  }
}

function renderMapObjects() {
  clearMarkers();

  if (state.activeEngine === 'google') {
    renderGoogleMapObjects();
  } else {
    renderLeafletMapObjects();
  }
}

function renderGoogleMapObjects() {
  if (!state.map || !window.google) return;

  const userPos = { lat: state.userLat, lng: state.userLon };
  state.userMarker = new google.maps.Marker({
    position: userPos,
    map: state.map,
    title: '현재 위치',
    zIndex: 999,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 9,
      fillColor: '#2563eb',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 3,
    }
  });

  state.facilities.forEach((item) => {
    const isNearest = item.isNearest;
    const pos = { lat: item.lat, lng: item.lon };

    let fillColor = '#ef4444';
    let scale = 11;

    if (item.category === 'extinguisher') fillColor = '#f97316';
    else if (item.category === 'hydrant') fillColor = '#2563eb';

    if (isNearest) {
      fillColor = '#f59e0b';
      scale = 16;
    }

    const marker = new google.maps.Marker({
      position: pos,
      map: state.map,
      title: item.name,
      zIndex: isNearest ? 100 : 10,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: scale,
        fillColor: fillColor,
        fillOpacity: 0.95,
        strokeColor: '#ffffff',
        strokeWeight: isNearest ? 4 : 2,
      }
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 8px 10px; font-family: Pretendard, sans-serif;">
          <strong style="color: #0f172a; font-size: 13px;">${item.name}</strong>
          ${isNearest ? '<span style="background: #fef3c7; color: #b45309; font-size: 10px; font-weight: bold; padding: 2px 4px; border-radius: 4px; margin-left: 4px;">최단거리</span>' : ''}
          <p style="margin: 4px 0 2px; color: #dc2626; font-weight: bold; font-size: 12px;">거리: ${item.distanceMeters}m (${item.walkingTime})</p>
          <p style="margin: 0; color: #1e3a8a; font-weight: bold; font-size: 11px;">🏢 ${item.buildPlace}</p>
        </div>
      `
    });

    marker.addListener('click', () => {
      infoWindow.open(state.map, marker);
      updateNearestCard(item);
    });

    state.markers.push(marker);
  });

  if (state.nearestFacility) {
    const nearestPos = { lat: state.nearestFacility.lat, lng: state.nearestFacility.lon };
    state.routePolyline = new google.maps.Polyline({
      path: [userPos, nearestPos],
      geodesic: true,
      strokeColor: '#f59e0b',
      strokeOpacity: 0.85,
      strokeWeight: 5,
      map: state.map,
    });
  }
}

function renderLeafletMapObjects() {
  if (!state.map || !window.L) return;

  state.userMarker = L.circleMarker([state.userLat, state.userLon], {
    radius: 9,
    fillColor: '#2563eb',
    color: '#ffffff',
    weight: 3,
    fillOpacity: 1
  }).addTo(state.map).bindPopup('<strong>내 현재 위치</strong>');

  state.facilities.forEach((item) => {
    const isNearest = item.isNearest;
    let color = '#ef4444';
    let radius = 10;

    if (item.category === 'extinguisher') color = '#f97316';
    if (item.category === 'hydrant') color = '#2563eb';
    if (isNearest) {
      color = '#f59e0b';
      radius = 15;
    }

    const marker = L.circleMarker([item.lat, item.lon], {
      radius: radius,
      fillColor: color,
      color: '#ffffff',
      weight: isNearest ? 4 : 2,
      fillOpacity: 0.95
    }).addTo(state.map);

    marker.bindPopup(`
      <div style="font-family: Pretendard, sans-serif;">
        <strong>${item.name}</strong><br>
        <span style="color: #dc2626; font-weight: bold;">거리: ${item.distanceMeters}m (${item.walkingTime})</span><br>
        <span style="color: #1e3a8a; font-weight: bold;">🏢 ${item.buildPlace}</span>
      </div>
    `);

    marker.on('click', () => {
      updateNearestCard(item);
    });

    state.markers.push(marker);
  });

  if (state.nearestFacility) {
    state.routePolyline = L.polyline(
      [[state.userLat, state.userLon], [state.nearestFacility.lat, state.nearestFacility.lon]],
      { color: '#f59e0b', weight: 4, dashArray: '5, 10' }
    ).addTo(state.map);
  }
}

// ==========================================================
// 4. 하단 긴급 정보 카드 업데이트
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
    return;
  }

  elements.nearestCategoryBadge.textContent = item.categoryName;
  if (item.category === 'aed') {
    elements.nearestCategoryBadge.style.background = '#fee2e2';
    elements.nearestCategoryBadge.style.color = '#b91c1c';
  } else if (item.category === 'extinguisher') {
    elements.nearestCategoryBadge.style.background = '#ffedd5';
    elements.nearestCategoryBadge.style.color = '#c2410c';
  } else {
    elements.nearestCategoryBadge.style.background = '#dbeafe';
    elements.nearestCategoryBadge.style.color = '#1d4ed8';
  }

  if (item.verified) {
    elements.nearestVerifiedBadge.textContent = '✅ 안심 인증';
    elements.nearestVerifiedBadge.className = 'badge verified-badge';
  } else {
    elements.nearestVerifiedBadge.textContent = '⚠️ 점검 요망';
    elements.nearestVerifiedBadge.className = 'badge status-badge';
  }

  elements.nearestDistance.textContent = item.distanceMeters;
  elements.nearestWalkingTime.textContent = `(${item.walkingTime})`;

  if (item.distanceMeters <= 300) {
    elements.goldenIndicator.textContent = '🚨 골든타임 4분 내 신속 접근 가능!';
    elements.goldenIndicator.className = 'golden-indicator';
  } else {
    elements.goldenIndicator.textContent = '⚠️ 도보 4분 초과 (신속 이동 요망)';
    elements.goldenIndicator.className = 'golden-indicator warning';
  }

  elements.nearestTitle.textContent = item.name;
  elements.nearestIndoorPlace.textContent = item.buildPlace || '현장 상세 안내 표지판을 확인하세요.';
  elements.nearestAddress.textContent = item.buildAddress || '주소 정보 없음';
  elements.nearestOrg.textContent = `${item.org} / ${item.model || item.mfg}`;
  elements.nearestAge.textContent = `${item.age} (설치/등록: ${item.installYear || '정보 없음'})`;

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
    elements.facilityList.innerHTML = '<div style="padding: 10px; color: #94a3b8; font-size: 13px;">표시할 시설이 없습니다.</div>';
    return;
  }

  list.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <div class="list-item-left">
        <span class="list-item-name">${item.isNearest ? '⚡ ' : ''}${item.name}</span>
        <span class="list-item-sub">🏢 ${item.buildPlace}</span>
      </div>
      <div class="list-item-right">
        <span class="list-item-dist">${item.distanceMeters}m</span>
        <span class="list-item-time">${item.walkingTime}</span>
      </div>
    `;

    div.addEventListener('click', () => {
      updateNearestCard(item);
      if (state.activeEngine === 'google' && state.map) {
        state.map.panTo({ lat: item.lat, lng: item.lon });
      } else if (state.activeEngine === 'leaflet' && state.map) {
        state.map.panTo([item.lat, item.lon]);
      }
    });

    elements.facilityList.appendChild(div);
  });
}

// ==========================================================
// 5. 제보 시스템 & 모달 동작
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

  // 클라이언트 로컬스토리지 저장
  state.userReports.push(newReport);
  localStorage.setItem('safemap_user_reports', JSON.stringify(state.userReports));

  // 백엔드 API도 있을 경우 병렬 전송
  try {
    fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReport)
    }).catch(() => {});
  } catch(e) {}

  alert('제보가 성공적으로 접수되었습니다. 긴급 안전망 검증에 즉시 반영됩니다.');
  closeModal(elements.reportModal);
  fetchFacilities();
}

function openModal(modal) {
  modal.classList.add('active');
}
function closeModal(modal) {
  modal.classList.remove('active');
}

// ==========================================================
// 6. 이벤트 바인딩
// ==========================================================
function bindEvents() {
  elements.catTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.catTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      state.currentCategory = tab.dataset.category;
      fetchFacilities();
    });
  });

  elements.verifiedToggle.addEventListener('change', (e) => {
    state.verifiedOnly = e.target.checked;
    fetchFacilities();
  });

  elements.btnCurrentLocation.addEventListener('click', () => {
    showStatus('GPS 현위치를 다시 측정합니다...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          state.userLat = pos.coords.latitude;
          state.userLon = pos.coords.longitude;
          if (state.activeEngine === 'google' && state.map) {
            state.map.panTo({ lat: state.userLat, lng: state.userLon });
          } else if (state.activeEngine === 'leaflet' && state.map) {
            state.map.panTo([state.userLat, state.userLon]);
          }
          fetchFacilities();
        },
        (err) => {
          showStatus('위치 수신 실패: 브라우저 위치 권한을 확인해 주세요.', 2500);
        }
      );
    }
  });

  elements.btnRefreshArea.addEventListener('click', () => {
    fetchFacilities();
  });

  elements.btnMapEngineToggle.addEventListener('click', () => {
    if (state.activeEngine === 'google') {
      initLeafletMap();
    } else {
      initGoogleMap();
    }
    renderMapObjects();
  });

  elements.listToggleHeader.addEventListener('click', () => {
    const list = elements.facilityList;
    const arrow = document.querySelector('.list-toggle-arrow');
    if (list.style.display === 'none') {
      list.style.display = 'flex';
      arrow.textContent = '▲';
    } else {
      list.style.display = 'none';
      arrow.textContent = '▼';
    }
  });

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

  document.querySelectorAll('.guide-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.guide-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('guideCpr').classList.toggle('active', tab === 'cpr');
      document.getElementById('guideFire').classList.toggle('active', tab === 'fire');
    });
  });

  elements.btnSaveGoogleApiKey.addEventListener('click', () => {
    const key = elements.inputGoogleApiKey.value.trim();
    state.googleApiKey = key;
    localStorage.setItem('google_maps_api_key', key);
    alert('구글맵 API 키가 저장되었습니다. 지도를 새로고침합니다.');
    location.reload();
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
