// API 클라이언트 서비스

export async function fetchConfig() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to load config:', err);
    return { success: false, error: err.message };
  }
}

export async function fetchFacilities(lat, lon, category = 'all', verifiedOnly = true) {
  try {
    const url = `/api/facilities?lat=${lat}&lon=${lon}&category=${category}&verifiedOnly=${verifiedOnly}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to load facilities:', err);
    return { success: false, facilities: [], stats: null, error: err.message };
  }
}

export async function fetchPedestrianDirections(origin, destination) {
  try {
    const res = await fetch('/api/routes/directions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to calculate pedestrian route:', err);
    return { success: false, error: err.message };
  }
}

export async function fetchRouteMatrix(origin, destinations) {
  try {
    const res = await fetch('/api/routes/matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destinations }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to calculate route matrix:', err);
    return { success: false, results: [] };
  }
}

export async function submitCheckin(facilityId, status, note = '') {
  try {
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId, status, note }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to submit checkin:', err);
    return { success: false, message: '상태 확인 접수 중 오류가 발생했습니다.' };
  }
}

export async function submitReport(reportData) {
  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to submit report:', err);
    return { success: false, message: '제보 접수 중 네트워크 오류가 발생했습니다.' };
  }
}

