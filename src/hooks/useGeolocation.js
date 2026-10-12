import { useState, useEffect, useCallback } from 'react';

const DEFAULT_LAT = 37.5665;
const DEFAULT_LON = 126.9780;

export function useGeolocation() {
  const [coords, setCoords] = useState({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
  const [isLiveGps, setIsLiveGps] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const requestGps = useCallback((forceFresh = false) => {
    setLoading(true);
    if (!navigator.geolocation) {
      setErrorMsg('현재 브라우저가 위치 정보를 지원하지 않습니다.');
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
        setIsLiveGps(false);
        setLoading(false);
        setErrorMsg('GPS 신호를 수신하지 못했습니다. 검색 또는 핀 드래그로 위치를 지정할 수 있습니다.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: forceFresh ? 0 : 10000,
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
