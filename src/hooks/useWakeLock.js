import { useEffect } from 'react';

/**
 * 길안내·CPR 중 화면 자동 꺼짐 방지 (Screen Wake Lock API)
 * - 다른 앱으로 전환했다 돌아오면 브라우저가 잠금을 해제하므로 화면 복귀 시 다시 요청
 * - 미지원 브라우저(구형 iOS 등)에서는 아무 동작도 하지 않음
 */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.wakeLock) return;

    let sentinel = null;
    let cancelled = false;

    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          lock.release();
          return;
        }
        sentinel = lock;
      } catch (e) {
        // 배터리 절약 모드 등으로 거부될 수 있음
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) {
        request();
      }
    };

    request();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
