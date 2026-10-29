import { useState, useEffect, useCallback } from 'react';

/**
 * 위치 상태
 * - checking: 권한 상태 확인 중
 * - prompt: 아직 허용 여부를 묻지 않음 (앱의 안내 화면을 먼저 보여줌)
 * - locating: 위치를 받는 중
 * - live: GPS 위치 확보
 * - manual: 검색으로 위치 지정
 * - denied: 권한 거부 또는 위치 확인 실패
 */
export function useGeolocation() {
  // 기본값을 임의 좌표(서울시청)로 두지 않아 오안내를 막는다
  const [coords, setCoords] = useState({ lat: null, lon: null });
  const [status, setStatus] = useState('checking');

  const requestGps = useCallback((forceFresh = false) => {
    if (!navigator.geolocation) {
      setStatus('denied');
      return;
    }
    setStatus((prev) => (prev === 'live' ? prev : 'locating'));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setStatus('live');
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setStatus((prev) => (prev === 'live' || prev === 'manual' ? prev : 'denied'));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: forceFresh ? 0 : 10000,
      }
    );
  }, []);

  // 이미 허용된 경우에만 바로 위치를 받고, 처음이면 앱 안내 화면에서 허용을 누르게 한다
  useEffect(() => {
    let cancelled = false;
    if (!navigator.permissions?.query) {
      requestGps();
      return undefined;
    }
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((perm) => {
        if (cancelled) return;
        if (perm.state === 'granted') requestGps();
        else if (perm.state === 'denied') setStatus('denied');
        else setStatus('prompt');
      })
      .catch(() => {
        if (!cancelled) requestGps();
      });
    return () => {
      cancelled = true;
    };
  }, [requestGps]);

  const setManualCoords = useCallback((lat, lon) => {
    setCoords({ lat, lon });
    setStatus('manual');
  }, []);

  return {
    coords,
    status,
    hasLocation: coords.lat !== null && coords.lon !== null,
    isLiveGps: status === 'live',
    loading: status === 'checking' || status === 'locating',
    requestGps,
    setManualCoords,
  };
}
