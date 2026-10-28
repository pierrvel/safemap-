import { useState, useEffect, useCallback } from 'react';

export function useGeolocation() {
  // 🌟 [1] 기본값을 서울시청으로 두지 않고 초기 상태를 null로 설정하여 레이스 컨디션 및 오안내 방지
  const [coords, setCoords] = useState({ lat: null, lon: null });
  const [isLiveGps, setIsLiveGps] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const requestGps = useCallback((forceFresh = false) => {
    setLoading(true);
    setErrorMsg(null);
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
        console.warn('Geolocation error:', err.message);
        setIsLiveGps(false);
        setLoading(false);
        // 서울시청으로 폴백하지 않고 위치 없음 상태 유지
        setCoords({ lat: null, lon: null });
        setErrorMsg('위치를 확인할 수 없어요. 장소를 검색해 위치를 지정해 주세요.');
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
    setLoading(false);
    setErrorMsg(null);
  }, []);

  return {
    coords,
    hasLocation: coords.lat !== null && coords.lon !== null,
    isLiveGps,
    loading,
    errorMsg,
    requestGps,
    setManualCoords,
  };
}
