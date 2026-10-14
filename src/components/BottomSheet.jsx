import React, { useRef } from 'react';

/**
 * 3단 스냅 바텀시트 (Minimized / Peek / Expanded)
 * - Minimized: 약 50px 미니 핸들바 (지도 시야 90% 이상 확보)
 * - Peek (기본 모드): 약 145~160px 핵심 요약 정보 3종 (거리/골든타임/신호등, buildPlace 상세위치, 길안내/119 버튼)
 * - Expanded: 전체 상세 정보 (장비 스펙, Micro Check-in, 24h 백업 대안, 랭킹 리스트)
 */
export default function BottomSheet({
  facilities = [],
  selectedFacility = null,
  onSelectFacility,
  snapState = 'peek', // 'minimized' | 'peek' | 'expanded'
  onSnapChange,
  onStartNavigation,
  onOpenReport,
  onCheckin,
  backup24h = null,
}) {
  const currentItem = selectedFacility || facilities[0] || null;
  const touchStartY = useRef(0);

  const getCategoryInfo = (cat) => {
    switch (cat) {
      case 'extinguisher':
        return { label: '보이는 소화기', badgeClass: 'extinguisher', icon: '🧯' };
      case 'hydrant':
        return { label: '소화전/비상소화장치', badgeClass: 'hydrant', icon: '💧' };
      default:
        return { label: '자동심장충격기 (AED)', badgeClass: 'aed', icon: '⚡' };
    }
  };

  const currentCatInfo = currentItem ? getCategoryInfo(currentItem.category) : { label: 'AED', badgeClass: 'aed', icon: '⚡' };

  const currentDist = currentItem?.realDistanceMeters || currentItem?.distanceMeters || '--';
  const currentDuration = currentItem?.realDurationText || currentItem?.walkingTime || '(도보 약 1분)';
  const isGoldenTime = typeof currentDist === 'number' && currentDist <= 300;

  // 가용성 신호등 상태 산출 (🟢 즉시 가용 / 🟡 야간 미개방 / 🔴 점검 필요)
  const getTrafficStatus = (item) => {
    if (!item) return { color: 'green', text: '🟢 즉시 사용 가능', class: 'status-green' };
    if (item.reportsCount > 0 || item.checkin?.lastStatus === 'ISSUE') {
      return { color: 'red', text: '🔴 고장·점검 필요', class: 'status-red' };
    }
    if (item.category === 'aed' && item.availableNow === false) {
      return { color: 'yellow', text: '🟡 야간·운영시간 외', class: 'status-yellow' };
    }
    return { color: 'green', text: '🟢 즉시 사용 가능', class: 'status-green' };
  };

  const trafficStatus = getTrafficStatus(currentItem);

  // 스와이프 제스처 처리
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY; // 양수: 위로 스와이프, 음수: 아래로 스와이프

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // 위로 드래그
        if (snapState === 'minimized') onSnapChange('peek');
        else if (snapState === 'peek') onSnapChange('expanded');
      } else {
        // 아래로 드래그
        if (snapState === 'expanded') onSnapChange('peek');
        else if (snapState === 'peek') onSnapChange('minimized');
      }
    }
  };

  // 핸들 클릭 토글
  const handleGripClick = () => {
    if (snapState === 'minimized') onSnapChange('peek');
    else if (snapState === 'peek') onSnapChange('expanded');
    else onSnapChange('peek');
  };

  return (
    <section
      className={`bottom-sheet ${snapState}`}
      id="facilitySheet"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 1. 상단 드래그 핸들 바 */}
      <div className="sheet-grip-area" onClick={handleGripClick} title="터치하여 시트 높이 조절">
        <div className="grip-bar"></div>
      </div>

      {/* 2. [Minimized 모드] 50px 초슬림 독 바 */}
      {snapState === 'minimized' && currentItem && (
        <div className="mini-dock-bar" onClick={() => onSnapChange('peek')}>
          <div className="mini-lead">
            <span className="mini-distance">{currentDist}m</span>
            <span className="mini-name">{currentItem.name}</span>
          </div>
          <div className="mini-sub">
            <span className="mini-place">🏢 {currentItem.buildPlace || currentItem.buildAddress || '위치 상세 정보'}</span>
            <span className="mini-arrow">▲ 올리기</span>
          </div>
        </div>
      )}

      {/* 3. [Peek 모드] 145~160px 컴팩트 핵심 요약 (지도 시야 80% 확보) */}
      {snapState === 'peek' && currentItem && (
        <div className="peek-content-wrapper">
          {/* 정보 1: 도보 시간/거리 + 골든타임 + 신호등 가용성 배지 */}
          <div className="peek-headline-row">
            <div className="peek-eta-box">
              <span className="peek-time-title">🚨 골든타임 도보</span>
              <span className="peek-dist-val">{currentDist}m</span>
              <span className="peek-time-val">({currentDuration})</span>
            </div>
            <div className="peek-badges-row">
              <span className={`traffic-badge ${trafficStatus.class}`}>
                {trafficStatus.text}
              </span>
              {isGoldenTime && (
                <span className="badge golden-pill">골든타임 4분 내</span>
              )}
            </div>
          </div>

          {/* 정보 2: 건물 내 상세 설치 위치 (가장 크고 굵은 하이라이트 박스) */}
          <div className="peek-indoor-box" onClick={() => onSnapChange('expanded')}>
            <div className="peek-indoor-icon">🏢</div>
            <div className="peek-indoor-text">
              {currentItem.buildPlace || currentItem.buildAddress || '상세 설치 위치 정보가 등록되어 있지 않습니다.'}
            </div>
          </div>

          {/* 정보 3: 핵심 액션 버튼 (길안내 시작 + 119 + 상세토글) */}
          <div className="peek-action-row">
            <button
              type="button"
              className="btn-peek-nav"
              onClick={() => onStartNavigation(currentItem)}
            >
              <span className="icon">🧭</span>
              <span>도보 길안내 시작</span>
            </button>

            <a href="tel:119" className="btn-peek-119">
              <span className="icon">🚨</span>
              <span>119</span>
            </a>

            <button
              type="button"
              className="btn-peek-expand"
              onClick={() => onSnapChange('expanded')}
              title="상세 정보 및 주변 시설 랭킹 보기"
            >
              <span>상세/랭킹 ▲</span>
            </button>

            <button
              type="button"
              className="btn-peek-minimize"
              onClick={() => onSnapChange('minimized')}
              title="바텀시트 최소화"
            >
              <span>─</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. [Expanded 모드] 전체 상세/제보/백업24h/랭킹 */}
      {snapState === 'expanded' && (
        <div className="sheet-content">
          <div className="expanded-top-ctrl">
            <span className="expanded-title">시설 상세 정보 & 주변 안전망</span>
            <button
              type="button"
              className="btn-fold-peek"
              onClick={() => onSnapChange('peek')}
            >
              접기 ▼
            </button>
          </div>

          {currentItem ? (
            <div className="emergency-hero-card">
              {/* 상단 거리 & 배지 */}
              <div className="hero-top-row">
                <div className="distance-metric">
                  <span className="val">{currentDist}</span>
                  <span className="unit">m</span>
                  <span className="eta">{currentDuration}</span>
                </div>
                <div className="hero-badges">
                  <span className={`traffic-badge ${trafficStatus.class}`}>
                    {trafficStatus.text}
                  </span>
                  {/* 좌표 신뢰도 배지 */}
                  <span className={`confidence-badge ${currentItem.locationConfidence === 'HIGH' ? 'high' : 'estimated'}`}>
                    {currentItem.locationConfidence === 'HIGH' ? '🟢 공인 정밀좌표' : '🟡 구역 좌표 (현장확인)'}
                  </span>
                  <span className={`badge cat-badge ${currentCatInfo.badgeClass}`}>
                    {currentCatInfo.label}
                  </span>
                </div>
              </div>

              {/* 시설명 */}
              <h2 className="hero-title">{currentItem.name}</h2>

              {/* 건물 내부 상세 설치 위치 강조 박스 */}
              <div className="indoor-hero-box">
                <div className="indoor-tag">
                  <span>🏢</span>
                  <span>건물 내부 상세 설치 위치</span>
                </div>
                <div className="indoor-text">
                  {currentItem.buildPlace || currentItem.buildAddress || '상세 위치 정보가 등록되어 있지 않습니다.'}
                </div>
              </div>

              {/* 2순위 24시간 백업 대안 시설 안내 배너 (야간 미개방 또는 추정좌표 시) */}
              {backup24h && backup24h.id !== currentItem.id && (!currentItem.availableNow || currentItem.category === 'extinguisher' || currentItem.reportsCount > 0) && (
                <div className="backup-24h-banner">
                  <div className="backup-icon">🌙</div>
                  <div className="backup-info">
                    <div className="backup-label">24시간 상시 가용 백업 시설 안내</div>
                    <div className="backup-desc">
                      현재 1순위 시설 야간 미개방 또는 현장 확인 대비: <b>{backup24h.name}</b> (도보 {backup24h.distanceMeters}m)
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-switch-backup"
                    onClick={() => onSelectFacility(backup24h)}
                  >
                    대안 선택 ➔
                  </button>
                </div>
              )}

              {/* 원터치 Micro Check-in 상태 확인 버튼 그룹 */}
              <div className="micro-checkin-box">
                <div className="checkin-label-row">
                  <span className="checkin-tit">🔍 시민 원터치 현장 상태 확인</span>
                  {currentItem.checkin && (
                    <span className="checkin-counts">
                      정상 {currentItem.checkin.normalCount || 0}회 · 고장 {currentItem.checkin.issueCount || 0}회
                    </span>
                  )}
                </div>
                <div className="checkin-btn-group">
                  <button
                    type="button"
                    className="btn-checkin normal"
                    onClick={() => onCheckin && onCheckin(currentItem.id, 'NORMAL')}
                    title="현장에 소방/구호 장비가 정상 비치되어 있음을 확인"
                  >
                    <span>👍 정상 비치 확인</span>
                  </button>

                  <button
                    type="button"
                    className="btn-checkin issue"
                    onClick={() => {
                      if (onCheckin) onCheckin(currentItem.id, 'ISSUE', '잠김/고장 신고');
                      onOpenReport(currentItem);
                    }}
                    title="자물쇠 잠김, 장비 훼손 또는 누락 신고"
                  >
                    <span>⚠️ 잠김·고장 신고</span>
                  </button>
                </div>
              </div>

              {/* 장비 스펙 메타 정보 */}
              <div className="hero-meta-row">
                <span className="meta-txt">{currentItem.buildAddress || '-'}</span>
                <span className="meta-dot">·</span>
                <span className="meta-txt">{currentItem.org || '-'}</span>
                <span className="meta-dot">·</span>
                <span className="meta-txt">
                  {currentItem.installYear ? `${currentItem.installYear}년 설치 (${currentItem.age || 0})` : '설치연도 미상'}
                </span>
                {currentItem.model && (
                  <>
                    <span className="meta-dot">·</span>
                    <span className="meta-txt">{currentItem.model}</span>
                  </>
                )}
              </div>

              {/* 액션 버튼 그룹 */}
              <div className="hero-action-grid">
                <button
                  type="button"
                  className="btn-action primary-nav"
                  onClick={() => onStartNavigation(currentItem)}
                >
                  <span className="icon">🧭</span>
                  <span>도보 길안내 시작</span>
                </button>

                <a href="tel:119" className="btn-primary-119">
                  <span className="icon">🚨</span>
                  <span>119 긴급통화</span>
                </a>

                <a
                  href={currentItem.clerkTel ? `tel:${currentItem.clerkTel}` : '#'}
                  className="btn-action subtle"
                  onClick={(e) => {
                    if (!currentItem.clerkTel) {
                      e.preventDefault();
                      alert('등록된 관리처 전화번호가 없습니다.');
                    }
                  }}
                >
                  <span className="icon">📞</span>
                  <span>관리처 ({currentItem.clerkTel || '없음'})</span>
                </a>

                <button
                  type="button"
                  className="btn-action subtle"
                  onClick={() => onOpenReport(currentItem)}
                >
                  <span className="icon">📝</span>
                  <span>상세 제보 접수</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
              주변에 검색된 안전시설이 없습니다.
            </div>
          )}

          {/* 가까운 시설 랭킹 목록 */}
          <div className="facility-ranking-section">
            <div className="ranking-header">
              <div className="ranking-header-title">
                <span className="ranking-title-icon">📍</span>
                <span className="ranking-title-text">내 위치 기준 가장 가까운 시설 순위</span>
                <span className="ranking-badge">(<b>{facilities.length}</b>개)</span>
              </div>
              <span className="ranking-guide-tip">터치 시 지도 핀 강조</span>
            </div>

            <div className="ranking-scroll-container">
              {facilities.slice(0, 15).map((facility, index) => {
                const isSelected = currentItem?.id === facility.id;
                const dist = facility.realDistanceMeters || facility.distanceMeters || '--';
                const timeText = facility.realDurationText || facility.walkingTime || '';
                const catInfo = getCategoryInfo(facility.category);
                const rankLabel = index === 0 ? '🏆 1위' : `#${index + 1}`;
                const rankClass = index === 0 ? 'card-rank gold' : 'card-rank';
                const isGolden = typeof dist === 'number' && dist <= 300;

                return (
                  <div
                    key={facility.id}
                    className={`facility-ranking-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectFacility(facility);
                      onSnapChange('peek');
                    }}
                  >
                    <div className={rankClass}>
                      <span>{rankLabel}</span>
                      {index === 0 && <span className="card-rank-sub">최단거리</span>}
                    </div>

                    <div className="card-main">
                      <div className="card-top-row">
                        <span className={`card-cat-badge ${catInfo.badgeClass}`}>
                          {catInfo.icon} {catInfo.label}
                        </span>
                        <span className="card-facility-name" title={facility.name}>
                          {facility.name}
                        </span>
                        {facility.category === 'aed' && facility.availableNow === false && (
                          <span style={{ fontSize: '9px', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '1px 4px', borderRadius: '4px' }}>
                            🌙 야간외
                          </span>
                        )}
                        {facility.locationConfidence === 'ESTIMATED' && (
                          <span style={{ fontSize: '9px', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '1px 4px', borderRadius: '4px' }}>
                            구역좌표
                          </span>
                        )}
                      </div>

                      <div className="card-indoor-info" title={facility.buildPlace || facility.buildAddress}>
                        <span>🏢</span>
                        <span>{facility.buildPlace || facility.buildAddress || '상세 위치 정보 없음'}</span>
                      </div>

                      <div className="card-dist-row">
                        <span className="card-dist-num">{dist}m</span>
                        <span className="card-time-eta">⏱️ {timeText}</span>
                        {facility.isRealRoad && (
                          <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '1.5px 5px', borderRadius: '4px' }}>
                            🚶 도보 실거리
                          </span>
                        )}
                        {isGolden && <span className="card-golden-pill">골든타임 4분 내</span>}
                      </div>
                    </div>

                    <div className="card-arrow-action">
                      <button
                        type="button"
                        className="btn-card-nav"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartNavigation(facility);
                        }}
                      >
                        길안내 ➔
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
