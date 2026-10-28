import React, { useState } from 'react';
import {
  Navigation,
  Heart,
  Phone,
  ClipboardCheck,
  MapPin,
  Building,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  List,
  Clock,
  Sparkles,
  EyeOff,
} from 'lucide-react';

/**
 * 🫀 Heartisense 감성의 가로/세로 모바일·태블릿 최적화 하단/사이드 긴급 카드
 * - 한눈에 보이는 대형 '도보 길안내 시작' 히어로 버튼
 * - 네이버지도처럼 지도를 가리지 않게 최소화(접기) 기능 지원
 * - 가로모드 시 좌측 플로팅 패널로 자동 전환
 */
export default function EmergencyBottomCard({
  facility,
  facilities = [],
  isNearest,
  onStartNavigation,
  onOpenCpr,
  onOpenAudit,
  onSelectFacility,
  isExpanded,
  onToggleExpand,
}) {
  const [isMinimized, setIsMinimized] = useState(false);

  // 시설 데이터가 아직 로딩 중이거나 없는 경우의 긴급 대기 바
  if (!facility) {
    return (
      <section className="v2-bottom-card empty-state" aria-label="긴급 안전시설 대기 바">
        <div className="v2-card-body">
          <div className="v2-empty-status-row">
            <div className="v2-empty-spinner"></div>
            <div className="v2-empty-text">
              <strong>주변 안전시설을 탐색하고 있습니다...</strong>
              <span>반경 3km 내 AED 및 대피소 검색 중</span>
            </div>
          </div>
          <div className="v2-quick-action-row">
            <button type="button" className="v2-btn-cpr-hero" onClick={onOpenCpr}>
              <Heart size={18} fill="currentColor" />
              <span>CPR 메트로놈 (105 BPM)</span>
            </button>
            <a href="tel:119" className="v2-btn-119-hero">
              <Phone size={17} />
              <span>119 통화</span>
            </a>
          </div>
        </div>
      </section>
    );
  }

  const isAed = facility.category === 'aed';
  const dist = facility.realDistanceMeters || facility.distanceMeters || 0;
  const timeText = facility.realDurationText || facility.walkingTime || '약 1분';
  const isGolden = dist <= 300;

  const isAvailableNow = facility.availableNow !== false;
  const isCalibrated = facility.locationConfidence === 'CALIBRATED';

  // 카카오맵 외부 길찾기 URL
  const kakaoMapUrl = `https://map.kakao.com/link/to/${encodeURIComponent(facility.name)},${facility.lat},${facility.lon}`;

  // 🌟 네이버지도처럼 완전히 접혔을 때의 초미니 바 (지도 시야 100% 확보)
  if (isMinimized) {
    return (
      <section
        className="v2-bottom-card minimized"
        aria-label="안전시설 요약 바"
        onClick={() => setIsMinimized(false)}
      >
        <div className="v2-card-minimized-row">
          <div className="v2-min-left">
            <span className={`v2-tag-cat mini ${isAed ? 'aed' : 'shelter'}`}>
              {isAed ? 'AED' : '대피소'}
            </span>
            <strong className="v2-min-name">{facility.name}</strong>
            <span className="v2-min-dist">
              {dist}m <small>({timeText})</small>
            </span>
            {facility.operatingHours && (
              <span className="v2-min-hours">· {facility.operatingHours}</span>
            )}
          </div>

          <div className="v2-min-actions">
            <button
              type="button"
              className="v2-btn-min-nav"
              onClick={(e) => {
                e.stopPropagation();
                onStartNavigation(facility);
              }}
              title="도보 길안내 시작"
            >
              <Navigation size={13} />
              <span>길안내</span>
            </button>

            <button
              type="button"
              className="v2-btn-min-expand"
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
              }}
              title="상세 정보 및 목록 펼치기"
            >
              <ChevronUp size={16} />
              <span>펼치기</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`v2-bottom-card ${isExpanded ? 'expanded' : ''}`}
      aria-label="긴급 안전시설 정보 및 길안내"
    >
      {/* 1. 상단 그립 바 및 '지도 넓게 보기(접기)' 버튼 */}
      <div className="v2-card-header-bar">
        <div className="v2-card-grip" onClick={onToggleExpand}>
          <div className="v2-grip-line"></div>
        </div>

        <button
          type="button"
          className="v2-btn-collapse-card"
          onClick={() => setIsMinimized(true)}
          title="네이버지도처럼 카드 접고 지도 넓게 보기"
        >
          <EyeOff size={13} />
          <span>지도 넓게 보기</span>
        </button>
      </div>

      <div className="v2-card-body">
        {/* 2. 상태 뱃지 & 거리 요약 */}
        <div className="v2-card-top-meta">
          <div className="v2-meta-tags">
            <span className={`v2-tag-cat ${isAed ? 'aed' : 'shelter'}`}>
              {isAed ? '⚡ AED' : '🏠 대피소'}
            </span>

            {isAvailableNow ? (
              <span className="v2-tag-status open">
                <Clock size={11} /> 지금 이용 가능
              </span>
            ) : (
              <span className="v2-tag-status closed">🌙 야간 운영시간 외</span>
            )}

            {/* 🌟 자체 위치 자동 보정 배지 */}
            {isCalibrated && (
              <span
                className="v2-tag-status calibrated"
                title="공공데이터포털 300m 오차를 건물 위치로 정밀 보정 완료"
              >
                <Sparkles size={11} /> 위치 자동 보정됨
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

          {/* 운영시간 1줄 요약 */}
          {facility.operatingHours && (
            <div className={`v2-facility-hours ${isAvailableNow ? 'open' : 'closed'}`}>
              <Clock size={12} className="v2-hours-icon" />
              <span>{facility.operatingHours}</span>
            </div>
          )}

          {facility.buildAddress && (
            <div className="v2-facility-address">
              <MapPin size={13} className="v2-addr-icon" />
              <span>{facility.buildAddress}</span>
            </div>
          )}
        </div>

        {/* 4. 🌟 대형 도보 길안내 시작 히어로 버튼 (절대 놓칠 수 없음) */}
        <button
          type="button"
          className="v2-hero-nav-btn"
          onClick={() => onStartNavigation(facility)}
          title="도보 실시간 러닝 길안내 시작"
        >
          <div className="v2-hero-nav-left">
            <Navigation size={22} className="v2-hero-nav-icon" />
            <div className="v2-hero-nav-text">
              <span className="v2-hero-title">도보 길안내 시작</span>
              <span className="v2-hero-sub">최단거리 보행 경로 안내</span>
            </div>
          </div>
          <div className="v2-hero-nav-badge">
            <span className="v2-hero-badge-dist">{dist}m</span>
            <span className="v2-hero-badge-time">도보 {timeText}</span>
          </div>
        </button>

        {/* 5. 4대 긴급 보조 액션 버튼 바 */}
        <div className="v2-action-bar-row">
          {/* A. 105 BPM CPR 메트로놈 */}
          <button
            type="button"
            className="v2-action-pill cpr"
            onClick={onOpenCpr}
            title="105 BPM CPR 메트로놈 & 응급의료법 면책 안내"
          >
            <Heart size={16} fill="currentColor" />
            <span>CPR 가이드</span>
          </button>

          {/* B. 119 즉시 전화 */}
          <a
            href="tel:119"
            className="v2-action-pill emergency"
            title="119 즉시 전화 걸기"
          >
            <Phone size={15} />
            <span>119 신고</span>
          </a>

          {/* C. 소방 연계 실사 점검 */}
          <button
            type="button"
            className="v2-action-pill audit"
            onClick={onOpenAudit}
            title="소방관·시민 현장 실사 점검"
          >
            <ClipboardCheck size={16} />
            <span>실사 점검</span>
          </button>

          {/* D. 외부 카카오맵 길찾기 연동 */}
          <a
            href={kakaoMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="v2-action-pill external"
            title="카카오맵 앱에서 길찾기 열기"
          >
            <ExternalLink size={15} />
            <span>카카오맵</span>
          </a>
        </div>

        {/* 6. 주변 시설 목록 (리스트) 접기/펼치기 서랍 */}
        {facilities.length > 1 && (
          <div className="v2-nearby-drawer-section">
            <button
              type="button"
              className="v2-btn-toggle-list"
              onClick={onToggleExpand}
            >
              <div className="v2-toggle-left">
                <List size={15} />
                <span>주변 시설 전체 목록 ({facilities.length}개)</span>
              </div>
              <div className="v2-toggle-right">
                <span className="v2-toggle-hint">{isExpanded ? '접기' : '목록 보기'}</span>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </div>
            </button>

            {/* 펼쳐졌을 때 나타나는 주변 시설 스크롤 리스트 */}
            {isExpanded && (
              <div className="v2-facility-list-scroll">
                {facilities.map((fac, idx) => {
                  const isSelected = fac.id === facility.id;
                  const itemDist = fac.realDistanceMeters || fac.distanceMeters || 0;
                  const itemTime = fac.realDurationText || fac.walkingTime || '약 1분';
                  const itemAed = fac.category === 'aed';
                  const itemOpen = fac.availableNow !== false;

                  return (
                    <div
                      key={fac.id || idx}
                      className={`v2-list-item-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => onSelectFacility(fac)}
                    >
                      <div className="v2-item-main-info">
                        <div className="v2-item-header">
                          <span className={`v2-tag-cat mini ${itemAed ? 'aed' : 'shelter'}`}>
                            {itemAed ? 'AED' : '대피소'}
                          </span>
                          <span className="v2-item-rank">{idx + 1}위</span>
                          <span className="v2-item-name">{fac.name}</span>
                          {itemOpen ? (
                            <span className="v2-item-open-dot" title="지금 이용 가능">🟢</span>
                          ) : (
                            <span className="v2-item-closed-dot" title="야간 운영시간 외">🌙</span>
                          )}
                        </div>

                        <div className="v2-item-place-row">
                          <Building size={13} className="text-slate-400" />
                          <span>{fac.buildPlace || fac.buildAddress || '위치 미제공'}</span>
                        </div>

                        {fac.operatingHours && (
                          <div className={`v2-item-hours-row ${itemOpen ? 'open' : 'closed'}`}>
                            <Clock size={10} />
                            <span>{fac.operatingHours}</span>
                          </div>
                        )}
                      </div>

                      <div className="v2-item-action-zone">
                        <div className="v2-item-dist-text">
                          <strong>{itemDist}m</strong>
                          <span>({itemTime})</span>
                        </div>
                        <button
                          type="button"
                          className="v2-item-nav-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectFacility(fac);
                            onStartNavigation(fac);
                          }}
                          title="이 시설로 길안내 시작"
                        >
                          <Navigation size={13} />
                          <span>길안내</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
