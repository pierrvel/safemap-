import React, { useState, useRef } from 'react';
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
 * 🫀 Heartisense 감성의 네이티브급 터치 스와이프 물리 엔진 하단 긴급 카드
 * - 손가락 궤적을 1:1로 자석처럼 추종하는 제스처 (60fps/120fps 무지연)
 * - 3단계 스냅 포인트 (collapsed: 초미니 바 / default: 긴급 카드 / expanded: 전체 목록)
 * - 플릭(Flick) 가속도 감속 및 스프링 스냅
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
  isLocating = false,
  locationError = null,
  isCachedView = false,
}) {
  // 🌟 네이티브 앱 수준의 3단계 스냅 상태 관리
  const [sheetState, setSheetState] = useState('default'); // 'collapsed' | 'default' | 'expanded'
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const currentDragY = useRef(0);

  // 터치 스와이프 제스처 핸들러
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    currentDragY.current = 0;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // 감쇠 저항(Rubber-band) 효과
    let damping = 1;
    if (sheetState === 'expanded' && deltaY < 0) damping = 0.25; // 위로 더 당길 때
    if (sheetState === 'collapsed' && deltaY > 0) damping = 0.25; // 아래로 더 내릴 때

    const finalOffset = deltaY * damping;
    currentDragY.current = finalOffset;
    setDragOffsetY(finalOffset);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const deltaY = currentDragY.current;
    const timeElapsed = Math.max(1, Date.now() - touchStartTime.current);
    const velocity = deltaY / timeElapsed; // px/ms

    // 빠른 스와이프 플릭(Velocity 기반) 또는 45px 이상 드래그 시 스냅
    if (velocity < -0.3 || deltaY < -45) {
      // 🚀 위로 스와이프: collapsed -> default -> expanded
      if (sheetState === 'collapsed') {
        setSheetState('default');
      } else if (sheetState === 'default') {
        setSheetState('expanded');
        onToggleExpand?.(true);
      }
    } else if (velocity > 0.3 || deltaY > 45) {
      // 🚀 아래로 스와이프: expanded -> default -> collapsed
      if (sheetState === 'expanded') {
        setSheetState('default');
        onToggleExpand?.(false);
      } else if (sheetState === 'default') {
        setSheetState('collapsed');
      }
    }

    setDragOffsetY(0);
    currentDragY.current = 0;
  };

  // 시설 데이터가 아직 로딩 중이거나 위치가 없는 경우의 안내 바
  if (!facility) {
    return (
      <section className="v2-bottom-card empty-state" aria-label="긴급 안전시설 안내 바">
        <div className="v2-card-body">
          <div className="v2-empty-status-row">
            {isLocating ? (
              <>
                <div className="v2-empty-spinner"></div>
                <div className="v2-empty-text">
                  <strong>위치를 확인하는 중입니다...</strong>
                  <span>GPS 신호를 수신하고 있습니다. 잠시만 기다려주세요.</span>
                </div>
              </>
            ) : locationError ? (
              <>
                <div className="v2-empty-icon" style={{ fontSize: '22px' }}>📍</div>
                <div className="v2-empty-text">
                  <strong>위치를 확인할 수 없어요</strong>
                  <span>상단 검색창에서 장소를 검색해 위치를 지정해 주세요</span>
                </div>
              </>
            ) : (
              <>
                <div className="v2-empty-spinner"></div>
                <div className="v2-empty-text">
                  <strong>주변 안전시설을 탐색하고 있습니다...</strong>
                  <span>반경 3km 내 AED 및 대피소 검색 중</span>
                </div>
              </>
            )}
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

  const isAvailableNow = facility.availableNow === true;
  const isUnavailableNow = facility.availableNow === false;
  const isUnknownHours = facility.availableNow === null || facility.availableNow === undefined;
  const isCalibrated = facility.locationConfidence === 'CALIBRATED';
  const isExpandedFinal = sheetState === 'expanded' || isExpanded;

  // 카카오맵 외부 길찾기 URL
  const kakaoMapUrl = `https://map.kakao.com/link/to/${encodeURIComponent(facility.name)},${facility.lat},${facility.lon}`;

  // 🌟 [1단계 스냅: Collapsed] 네이버지도처럼 완전히 접힌 초미니 바 (스와이프로 즉시 끌어올림 가능)
  if (sheetState === 'collapsed') {
    return (
      <section
        className="v2-bottom-card minimized"
        aria-label="안전시설 요약 바"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: isDragging ? `translate3d(0, ${dragOffsetY}px, 0)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
        }}
      >
        <div className="v2-card-minimized-row" onClick={() => setSheetState('default')}>
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
                setSheetState('default');
              }}
              title="상세 정보 펼치기"
            >
              <ChevronUp size={16} />
              <span>펼치기</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  // 🌟 [2단계 & 3단계 스냅: Default / Expanded]
  return (
    <section
      className={`v2-bottom-card ${isExpandedFinal ? 'expanded' : ''}`}
      aria-label="긴급 안전시설 정보 및 길안내"
      style={{
        transform: isDragging ? `translate3d(0, ${dragOffsetY}px, 0)` : undefined,
        transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), max-height 0.28s ease',
        willChange: 'transform',
      }}
    >
      {/* 1. 상단 그립 바 (터치 스와이프 메인 핸들) */}
      <div
        className="v2-card-header-bar"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="v2-card-grip"
          onClick={() => {
            const next = sheetState === 'expanded' ? 'default' : 'expanded';
            setSheetState(next);
            onToggleExpand?.(next === 'expanded');
          }}
        >
          <div className="v2-grip-line"></div>
        </div>

        <button
          type="button"
          className="v2-btn-collapse-card"
          onClick={() => setSheetState('collapsed')}
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

            {isAvailableNow && (
              <span className="v2-tag-status open">
                <Clock size={11} /> 지금 이용 가능
              </span>
            )}
            {isUnavailableNow && (
              <span className="v2-tag-status closed">🌙 이용 불가 (운영시간 외)</span>
            )}
            {isUnknownHours && (
              <span className="v2-tag-status" style={{ background: '#f1f5f9', color: '#64748b' }}>
                운영시간 미확인
              </span>
            )}

            {isCachedView && (
              <span className="v2-tag-status" style={{ background: '#f1f5f9', color: '#64748b' }} title="현재 위치 기준 이전 캐시 데이터입니다">
                이전 결과
              </span>
            )}

            {facility.locationConfidence === 'CHECK_NEEDED' && (
              <span
                className="v2-tag-status"
                style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
                title="공공데이터 등록 주소와 지도 좌표 간 차이가 있어 현장 위치 확인이 필요합니다"
              >
                위치 확인 필요
              </span>
            )}

            {/* 🌟 자체 위치 자동 보정 배지 */}
            {isCalibrated && (
              <span
                className="v2-tag-status calibrated"
                title="건물 위치 기준 좌표입니다"
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

        {/* 3. 시설명 & 상세 설치위치 & 운영시간 */}
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

          {/* 간결한 1줄 운영시간 표기 */}
          {facility.operatingHours && (
            <div className={`v2-facility-hours ${isAvailableNow ? 'open' : (isUnavailableNow ? 'closed' : '')}`}>
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

          {/* C. 현장 실사 점검 */}
          <button
            type="button"
            className="v2-action-pill audit"
            onClick={onOpenAudit}
            title="현장 실사 점검"
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
              onClick={() => {
                const next = sheetState === 'expanded' ? 'default' : 'expanded';
                setSheetState(next);
                onToggleExpand?.(next === 'expanded');
              }}
            >
              <div className="v2-toggle-left">
                <List size={15} />
                <span>주변 시설 전체 목록 ({facilities.length}개)</span>
              </div>
              <div className="v2-toggle-right">
                <span className="v2-toggle-hint">
                  {isExpandedFinal ? '접기' : '목록 보기'}
                </span>
                {isExpandedFinal ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </div>
            </button>

            {/* 펼쳐졌을 때 나타나는 주변 시설 스크롤 리스트 */}
            {isExpandedFinal && (
              <div className="v2-facility-list-scroll">
                {facilities.map((fac, idx) => {
                  const isSelected = fac.id === facility.id;
                  const itemDist = fac.realDistanceMeters || fac.distanceMeters || 0;
                  const itemTime = fac.realDurationText || fac.walkingTime || '약 1분';
                  const itemAed = fac.category === 'aed';
                  const isItemOpen = fac.availableNow === true;
                  const isItemClosed = fac.availableNow === false;

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
                          {isItemOpen ? (
                            <span className="v2-item-open-dot" title="지금 이용 가능">🟢</span>
                          ) : isItemClosed ? (
                            <span className="v2-item-closed-dot" title="야간/휴무 운영시간 외">🌙</span>
                          ) : (
                            <span className="v2-item-closed-dot" title="운영시간 미확인">⚪</span>
                          )}
                        </div>

                        <div className="v2-item-place-row">
                          <Building size={13} className="text-slate-400" />
                          <span>{fac.buildPlace || fac.buildAddress || '위치 미제공'}</span>
                        </div>

                        {fac.operatingHours && (
                          <div className={`v2-item-hours-row ${isItemOpen ? 'open' : (isItemClosed ? 'closed' : '')}`}>
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
