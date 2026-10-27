import React from 'react';
import { Navigation, X, Phone, Compass } from 'lucide-react';

export default function NavigationHUD({
  navData,
  destination,
  onClose,
}) {
  if (!destination) return null;

  const dist = navData?.totalDistanceMeters || destination.realDistanceMeters || destination.distanceMeters || 0;
  const minutes = navData?.durationMinutes || Math.max(1, Math.round(dist / 75));

  return (
    <div className="v2-nav-hud" role="region" aria-label="실시간 도보 내비게이션">
      <div className="v2-hud-card">
        {/* 상단 남은 거리 및 소요시간 */}
        <div className="v2-hud-top">
          <div className="v2-hud-eta-box">
            <span className="v2-hud-eta-val">{dist}m</span>
            <span className="v2-hud-eta-time">도보 약 {minutes}분</span>
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

        {/* 목적지 및 상세 위치 안내 */}
        <div className="v2-hud-dest">
          <div className="v2-hud-dest-title">
            <Navigation size={16} className="text-blue-500 animate-pulse" />
            <span className="v2-hud-name">{destination.name}</span>
          </div>
          <div className="v2-hud-indoor-text">
            🏢 {destination.buildPlace || destination.buildAddress || '상세 설치 위치로 이동하세요.'}
          </div>
        </div>
      </div>
    </div>
  );
}
