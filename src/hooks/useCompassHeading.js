import { useEffect, useState } from 'react';

// 아이폰은 방향 센서 권한을 버튼을 누르는 순간에만 물을 수 있다 (안내 시작을 누를 때 호출)
export function requestCompassPermission() {
  const D = typeof window !== 'undefined' ? window.DeviceOrientationEvent : undefined;
  if (D && typeof D.requestPermission === 'function') {
    return D.requestPermission().catch(() => 'denied');
  }
  return Promise.resolve('granted');
}

const MIN_CHANGE_DEG = 2;

/**
 * 휴대폰이 향한 방위(북쪽 0°, 시계 방향). 센서가 없거나 권한이 없으면 null.
 * - 안드로이드: deviceorientationabsolute (alpha는 반시계 방향이라 360-alpha)
 * - 아이폰: webkitCompassHeading
 */
export default function useCompassHeading(enabled) {
  const [heading, setHeading] = useState(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    let hasAbsolute = false;
    let last = null;

    const update = (raw) => {
      const screenAngle = window.screen?.orientation?.angle || 0;
      const next = (((raw + screenAngle) % 360) + 360) % 360;
      if (last !== null) {
        const diff = Math.abs(((next - last + 540) % 360) - 180);
        if (diff < MIN_CHANGE_DEG) return;
      }
      last = next;
      setHeading(next);
    };

    const onAbsolute = (e) => {
      if (e.alpha === null || e.alpha === undefined) return;
      hasAbsolute = true;
      update(360 - e.alpha);
    };
    const onOrientation = (e) => {
      if (typeof e.webkitCompassHeading === 'number') {
        update(e.webkitCompassHeading);
      } else if (!hasAbsolute && e.absolute && e.alpha !== null && e.alpha !== undefined) {
        update(360 - e.alpha);
      }
    };

    window.addEventListener('deviceorientationabsolute', onAbsolute);
    window.addEventListener('deviceorientation', onOrientation);
    return () => {
      window.removeEventListener('deviceorientationabsolute', onAbsolute);
      window.removeEventListener('deviceorientation', onOrientation);
    };
  }, [enabled]);

  return heading;
}
