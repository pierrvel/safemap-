import { useState, useEffect, useCallback } from 'react';

const DEFAULT_LAT = 37.5665;
const DEFAULT_LON = 126.9780;

export function useGeolocation() {
  const [coords, setCoords] = useState({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
  const [isLiveGps, setIsLiveGps] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const requestGps = useCallback(() => {
    setLoading(true);
    if (!navigator.geolocation) {
      setErrorMsg('현재 브라우저가 위치 정보를 지원하지 않아 서울시청으로 기본 설정합니다.');
      setCoords({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
      setIsLiveGps(false);
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
        setIsLiveGps(true);
        setLoading(false);
        setErrorMsg(null);
      },
      (err) => {
        console.warn('Geolocation fallback:', err.message);
        setCoords({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
        setIsLiveGps(false);
        setLoading(false);
        setErrorMsg('GPS 신호를 가져올 수 없어 서울시청 중심으로 표시합니다.');
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 15000,
      }
    );
  }, []);

  useEffect(() => {
    requestGps();
  }, [requestGps]);

  const setManualCoords = useCallback((lat, lon) => {
    setCoords({ lat, lon });
    setIsLiveGps(false);
  }, []);

  return {
    coords,
    isLiveGps,
    loading,
    errorMsg,
    requestGps,
    setManualCoords,
  };
}
