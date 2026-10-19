import { useState, useEffect } from 'react';

export function useKakaoLoader(appKey) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!appKey) return;

    // 이미 window.kakao.maps 가 로드되어 있으면 바로 완료
    if (window.kakao && window.kakao.maps && window.kakao.maps.LatLng) {
      setLoaded(true);
      return;
    }

    const scriptId = 'kakao-maps-sdk';
    let script = document.getElementById(scriptId);

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'text/javascript';
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&libraries=services,clusterer&appkey=${appKey}`;
      script.async = true;

      script.onload = () => {
        if (window.kakao && window.kakao.maps) {
          window.kakao.maps.load(() => {
            setLoaded(true);
            setError(null);
          });
        } else {
          setError({
            type: 'INIT_ERROR',
            message: '카카오맵 객체를 초기화할 수 없습니다.',
          });
        }
      };

      script.onerror = () => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setError({
          type: 'DOMAIN_MISMATCH',
          origin,
          message: `카카오맵 SDK 스크립트 로드 실패. 현재 도메인(${origin})이 카카오 개발자 콘솔의 [Web 사이트 도메인]에 등록되지 않았습니다.`,
        });
      };

      document.head.appendChild(script);
    } else {
      // 스크립트가 이미 존재하는 경우
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          setLoaded(true);
        });
      } else {
        script.addEventListener('load', () => {
          window.kakao.maps.load(() => {
            setLoaded(true);
          });
        });
      }
    }
  }, [appKey]);

  return { loaded, error };
}
