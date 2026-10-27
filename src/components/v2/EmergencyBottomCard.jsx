import React from 'react';
import { Navigation, Heart, Phone, ClipboardCheck, MapPin, Building, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * 🫀 Heartisense 감성의 모바일 세로모드 전용 하단 긴급 카드
 * - 화면 하단 25%만 점유하여 지도 시야 75% 이상 확보
 * - '지금 이용 가능한 가장 가까운 AED' 우선 표시
 * - 한 손 엄지손가락으로 닿는 대형 긴급 액션 버튼 4종
 */
export default function EmergencyBottomCard({
  facility,
  isNearest,
  onStartNavigation,
  onOpenCpr,
  onOpenAudit,
  isExpanded,
  onToggleExpand,
}) {
  if (!facility) return null;

  const isAed = facility.category === 'aed';
  const dist = facility.realDistanceMeters || facility.distanceMeters || 0;
  const timeText = facility.realDurationText || facility.walkingTime || '약 1분';
  const isGolden = dist <= 300;

  const isAvailableNow = facility.availableNow !== false;
  const isCalibrated = facility.locationConfidence === 'CALIBRATED';

  return (
    <section className={`v2-bottom-card ${isExpanded ? 'expanded' : ''}`} aria-label="긴급 안전시설 정보">
      {/* 1. 상단 드래그/확장 핸들 */}
      <div className="v2-card-grip" onClick={onToggleExpand}>
        <div className="v2-grip-line"></div>
      </div>

      <div className="v2-card-body">
        {/* 2. 상태 뱃지 & 거리 요약 */}
        <div className="v2-card-top-meta">
          <div className="v2-meta-tags">
            <span className={`v2-tag-cat ${isAed ? 'aed' : 'shelter'}`}>
              {isAed ? '⚡ AED' : '🏠 대피소'}
            </span>

            {isAvailableNow ? (
              <span className="v2-tag-status open">🟢 지금 이용 가능</span>
            ) : (
              <span className="v2-tag-status closed">🌙 야간 운영시간 외</span>
            )}

            {/* 🌟 사용자분의 핵심 기술: 위치 자동 보정 배지 */}
            {isCalibrated && (
              <span className="v2-tag-status calibrated" title="공공데이터포털 300m 오차를 실제 건물 위치로 자동 보정 완료">
                🔵 고정밀 위치 보정됨
              </span>
            )}

            {isGolden && <span className="v2-tag-status golden">골든타임 4분 내</span>}
          </div>

          <div className="v2-distance-badge">
            <span className="v2-dist-val">{dist}m</span>
            <span className="v2-dist-sub">({timeText})</span>
          </div>
        </div>

        {/* 3. 시설명 & 상세 설치위치 (가장 크고 또렷하게) */}
        <div className="v2-card-title-zone">
          <h2 className="v2-facility-name" title={facility.name}>
            {facility.name}
          </h2>

          <div className="v2-facility-place">
            <Building size={15} className="v2-place-icon" />
            <span className="v2-place-text">
              {facility.buildPlace || facility.buildAddress || '상세 설치 위치 정보 없음'}
            </span>
          </div>

          {facility.buildAddress && (
            <div className="v2-facility-address">
              <MapPin size={13} className="v2-addr-icon" />
              <span>{facility.buildAddress}</span>
            </div>
          )}
        </div>

        {/* 4. 엄지손가락 원터치 4대 긴급 액션 버튼 */}
        <div className="v2-action-grid">
          {/* A. 전력질주 러닝 내비 */}
          <button
            type="button"
            className="v2-btn-run"
            onClick={() => onStartNavigation(facility)}
          >
            <Navigation size={18} className="v2-nav-icon" />
            <div className="v2-btn-text-group">
              <span className="v2-btn-main">도보 길안내 시작</span>
              <span className="v2-btn-sub">최단거리 러닝 경로</span>
            </div>
          </button>

          {/* B. 105 BPM CPR 메트로놈 */}
          <button
            type="button"
            className="v2-btn-cpr"
            onClick={onOpenCpr}
          >
            <Heart size={18} className="v2-cpr-icon" fill="currentColor" />
            <div className="v2-btn-text-group">
              <span className="v2-btn-main">CPR 가이드</span>
              <span className="v2-btn-sub">105 BPM 메트로놈</span>
            </div>
          </button>

          {/* C. 119 즉시 통화 */}
          <a href="tel:119" className="v2-btn-119" title="119 즉시 전화">
            <Phone size={17} />
            <span>119</span>
          </a>

          {/* D. 소방서 연계 실사 점검 */}
          <button
            type="button"
            className="v2-btn-audit"
            onClick={onOpenAudit}
            title="소방관·시민 현장 실사 점검"
          >
            <ClipboardCheck size={18} />
            <span>점검</span>
          </button>
        </div>
      </div>
    </section>
  );
}
