import React, { useState } from 'react';

export default function InAppNavigation({
  navData,
  destination,
  onClose,
  onFollowGps,
  onFitRoute,
}) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  if (!destination) return null;

  const steps = navData?.steps || [];
  const currentStep = steps[currentStepIdx] || {
    instruction: '목적지를 향해 도로망을 따라 이동하세요.',
    distanceMeters: navData?.totalDistanceMeters || destination.distanceMeters || 0,
    durationSeconds: navData?.totalDurationSeconds || 60,
    type: 'continue',
  };

  const getStepIcon = (type) => {
    switch (type) {
      case 'turn-left':
        return '⬅️';
      case 'turn-right':
        return '➡️';
      case 'arrive':
        return '🎯';
      default:
        return '🚶';
    }
  };

  const distM = navData?.totalDistanceMeters || destination.realDistanceMeters || destination.distanceMeters || '--';
  const timeMin = navData?.durationMinutes || Math.max(1, Math.round(Number(distM) / 75));

  return (
    <div className="in-app-nav-panel">
      <div className="nav-panel-top">
        <div className="nav-status-badge">
          <span className="nav-live-dot"></span>
          <span>도보 실시간 길안내</span>
        </div>
        <button
          type="button"
          className="btn-close-nav"
          onClick={onClose}
          title="길안내 종료"
        >
          종료 ✕
        </button>
      </div>

      <div className="nav-target-row">
        <div className="nav-target-info">
          <h3 className="nav-dest-title">{destination.name}</h3>
          <p className="nav-dest-place">
            🏢 {destination.buildPlace || destination.buildAddress || '위치 상세 정보 없음'}
          </p>
        </div>
        <div className="nav-target-metric">
          <div className="nav-dist-box">
            <span className="nav-dist-num">{distM}</span>
            <span className="nav-dist-unit">m</span>
          </div>
          <span className="nav-duration-txt">약 {timeMin}분</span>
        </div>
      </div>

      {/* 턴바이턴 보행 가이드 */}
      <div className="nav-turn-by-turn-card">
        <div className="nav-current-step">
          <span className="step-icon">{getStepIcon(currentStep.type)}</span>
          <div className="step-text-wrap">
            <div className="step-main">{currentStep.instruction}</div>
            <div className="step-sub">
              {currentStep.distanceMeters > 0 && `약 ${currentStep.distanceMeters}m 진행 · `}
              실제 보행 도로망 반영
            </div>
          </div>
        </div>

        {steps.length > currentStepIdx + 1 && (
          <div className="nav-next-step">
            <span className="next-label">다음 안내</span>
            <span className="next-text">
              {steps[currentStepIdx + 1].instruction} ({steps[currentStepIdx + 1].distanceMeters}m 앞)
            </span>
          </div>
        )}
      </div>

      {/* 내비게이션 하단 컨트롤 버튼 */}
      <div className="nav-action-row">
        <button
          type="button"
          className="btn-nav-control"
          onClick={onFollowGps}
        >
          📍 내 위치 추적
        </button>
        <button
          type="button"
          className="btn-nav-control"
          onClick={onFitRoute}
        >
          🔍 전체 경로 보기
        </button>
        <a href="tel:119" className="btn-nav-emergency">
          🚨 119 통화
        </a>
      </div>
    </div>
  );
}
