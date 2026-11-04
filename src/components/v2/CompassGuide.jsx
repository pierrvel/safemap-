import React, { useRef } from 'react';
import useCompassHeading from '../../hooks/useCompassHeading';
import { formatDistance, getBearing, getDirectionText } from '../../utils/format';

// 359°→1°처럼 넘어갈 때 화살표가 한 바퀴 돌지 않도록 가장 가까운 각도로 이어 붙인다
function useContinuousAngle(angle) {
  const ref = useRef(angle);
  const delta = ((angle - ref.current + 540) % 360) - 180;
  ref.current += delta;
  return ref.current;
}

/**
 * 지도 없이 길안내할 때의 나침반: 목적지 쪽을 가리키는 큰 화살표와 남은 거리
 * - 방향 센서가 있으면 휴대폰을 돌리는 대로 화살표가 목적지를 계속 가리킨다
 * - 센서가 없으면 화면 위쪽을 북쪽으로 두고 방위를 보여준다
 */
export default function CompassGuide({ from, to, remainingMeters, bottomOffset, compact = false }) {
  const heading = useCompassHeading(true);
  const bearing = getBearing(from.lat, from.lon, to.lat, to.lon);
  const arrowAngle = useContinuousAngle(heading === null ? bearing : bearing - heading);
  const northAngle = useContinuousAngle(heading === null ? 0 : -heading);
  const direction = getDirectionText(from.lat, from.lon, to.lat, to.lon);

  return (
    <div
      className={`sm-compass${compact ? ' is-compact' : ''}`}
      style={compact ? undefined : { bottom: bottomOffset + 16 }}
      role="img"
      aria-label={`${direction} ${formatDistance(remainingMeters)}`}
    >
      <div className="sm-compass-dial">
        <span className="sm-compass-north" style={{ transform: `rotate(${northAngle}deg)` }} aria-hidden="true">
          <span>북</span>
        </span>
        <svg className="sm-compass-arrow" viewBox="0 0 100 100" style={{ transform: `rotate(${arrowAngle}deg)` }} aria-hidden="true">
          <path d="M50 8 L78 74 L50 60 L22 74 Z" fill="currentColor" stroke="#FFFFFF" strokeWidth="4" strokeLinejoin="round" />
        </svg>
      </div>
      {!compact && (
        <p className="sm-compass-text">
          <strong>{direction}</strong> · {formatDistance(remainingMeters)}
        </p>
      )}
      <p className="sm-compass-hint" hidden={compact}>
        {heading === null ? '화면 위쪽이 북쪽이에요. 방향을 맞춰 걸어가세요.' : '휴대폰을 평평하게 들고 화살표 쪽으로 걸어가세요.'}
      </p>
    </div>
  );
}
