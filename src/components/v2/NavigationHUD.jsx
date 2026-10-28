import React, { useMemo } from 'react';
import {
  Navigation,
  X,
  Phone,
  CornerUpLeft,
  CornerUpRight,
  ArrowUp,
  ArrowUpRight,
  RotateCw,
  Flag,
  Footprints,
  AlertTriangle,
  Building,
} from 'lucide-react';
import { calculateDistanceMeters } from '../../utils/mapIcons';

// 서버가 보내는 안내 기호를 앱 공통 선 아이콘으로 변환
const STEP_ICONS = {
  '↰': CornerUpLeft,
  '↱': CornerUpRight,
  '⬆️': ArrowUp,
  '↗️': ArrowUpRight,
  '🔄': RotateCw,
  '🎯': Flag,
};

const ARRIVAL_RADIUS_METERS = 20;
const OFF_ROUTE_METERS = 50;

// 경로 좌표 중 주어진 위치에서 가장 가까운 점의 인덱스와 거리
function findNearestIndex(path, lat, lon) {
  let bestIdx = 0;
  let bestDist = Infinity;
  path.forEach((pt, idx) => {
    const d = calculateDistanceMeters(lat, lon, pt.lat, pt.lng);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = idx;
    }
  });
  return { idx: bestIdx, dist: bestDist };
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  if (mins === 0) return `약 ${Math.max(Math.round(seconds), 10)}초`;
  return `약 ${mins}분`;
}

export default function NavigationHUD({
  navData,
  destination,
  currentPosition,
  onClose,
}) {
  const path = useMemo(
    () => (navData?.coordinates || []).filter((pt) => pt && pt.lat !== undefined && pt.lng !== undefined),
    [navData]
  );

  // 경로 끝에서부터 각 좌표까지 남은 누적 거리
  const remainingFromIdx = useMemo(() => {
    const acc = new Array(path.length).fill(0);
    for (let i = path.length - 2; i >= 0; i--) {
      acc[i] = acc[i + 1] + calculateDistanceMeters(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
    }
    return acc;
  }, [path]);

  // 각 턴바이턴 안내 지점이 경로 좌표의 몇 번째에 해당하는지
  const stepsWithIdx = useMemo(
    () =>
      (navData?.steps || [])
        .filter((s) => s.location)
        .map((s) => ({ ...s, pathIdx: findNearestIndex(path, s.location.lat, s.location.lng).idx })),
    [navData, path]
  );

  if (!destination) return null;

  const totalDist = navData?.distanceMeters ?? destination.realDistanceMeters ?? destination.distanceMeters ?? 0;
  const totalSec = navData?.durationSeconds ?? totalDist / 1.25;
  // 경로상의 평균 보행 속도 (m/s)
  const speed = totalDist > 0 && totalSec > 0 ? totalDist / totalSec : 1.25;

  let remainingDist = totalDist;
  let nextStep = stepsWithIdx.find((s) => s.icon !== '🏁') || null;
  let nextStepDist = null;
  let isOffRoute = false;
  let hasArrived = false;

  if (currentPosition && path.length > 1) {
    const { lat, lon } = currentPosition;
    const nearest = findNearestIndex(path, lat, lon);
    remainingDist = nearest.dist + remainingFromIdx[nearest.idx];
    isOffRoute = nearest.dist > OFF_ROUTE_METERS;
    hasArrived = calculateDistanceMeters(lat, lon, destination.lat, destination.lon) <= ARRIVAL_RADIUS_METERS;

    nextStep = stepsWithIdx.find((s) => s.pathIdx > nearest.idx) || null;
    if (nextStep) {
      nextStepDist = nearest.dist + remainingFromIdx[nearest.idx] - remainingFromIdx[nextStep.pathIdx];
    }
  }

  const StepIcon = (nextStep && STEP_ICONS[nextStep.icon]) || Footprints;

  return (
    <div className="v2-nav-hud" role="region" aria-label="실시간 도보 내비게이션">
      <div className="v2-hud-card">
        {/* 상단 남은 거리 및 소요시간 */}
        <div className="v2-hud-top">
          <div className="v2-hud-eta-box">
            {hasArrived ? (
              <span className="v2-hud-eta-val">도착</span>
            ) : (
              <>
                <span className="v2-hud-eta-val">{Math.round(remainingDist)}m</span>
                <span className="v2-hud-eta-time">도보 {formatDuration(remainingDist / speed)}</span>
              </>
            )}
          </div>

          <div className="v2-hud-actions">
            <a href="tel:119" className="v2-btn-hud-119" title="119 통화">
              <Phone size={15} />
              <span>119</span>
            </a>
            <button
              type="button"
              className="v2-btn-hud-close"
              onClick={onClose}
              title="길안내 종료"
            >
              <X size={18} />
              <span>종료</span>
            </button>
          </div>
        </div>

        {/* 다음 턴바이턴 안내 */}
        {!hasArrived && nextStep && (
          <div className="v2-hud-next-step">
            <span className="v2-hud-step-icon">
              <StepIcon size={22} />
            </span>
            <span className="v2-hud-step-text">
              {nextStepDist !== null && <small>{Math.round(nextStepDist)}m 앞</small>}
              {nextStep.instruction}
            </span>
          </div>
        )}

        {!hasArrived && isOffRoute && (
          <div className="v2-hud-warning">
            <AlertTriangle size={13} /> 경로에서 벗어났어요. 지도의 파란 경로를 확인하세요.
          </div>
        )}

        {navData && navData.isRealRoad === false && (
          <div className="v2-hud-warning">
            <AlertTriangle size={13} /> 도보 경로를 불러오지 못해 직선 방향으로 안내합니다.
          </div>
        )}

        {/* 목적지 및 상세 위치 안내 */}
        <div className="v2-hud-dest">
          <div className="v2-hud-dest-title">
            <Navigation size={15} className="v2-hud-dest-icon" />
            <span className="v2-hud-name">{destination.name}</span>
          </div>
          <div className="v2-hud-indoor-text">
            <Building size={13} />
            <span>{destination.buildPlace || destination.buildAddress || '상세 설치 위치로 이동하세요.'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
