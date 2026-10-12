import React from 'react';

export default function BottomSheet({
  facilities,
  selectedFacility,
  onSelectFacility,
  isCollapsed,
  onToggleCollapse,
  onStartNavigation,
  onOpenReport,
}) {
  const currentItem = selectedFacility || facilities[0] || null;

  const getCategoryInfo = (cat) => {
    switch (cat) {
      case 'extinguisher':
        return { label: '소화기', badgeClass: 'extinguisher', icon: '🧯' };
      case 'hydrant':
        return { label: '소화전', badgeClass: 'hydrant', icon: '💧' };
      default:
        return { label: 'AED', badgeClass: 'aed', icon: '⚡' };
    }
  };

  const currentCatInfo = currentItem ? getCategoryInfo(currentItem.category) : { label: 'AED', badgeClass: 'aed', icon: '⚡' };

  const currentDist = currentItem?.realDistanceMeters || currentItem?.distanceMeters || '--';
  const currentDuration = currentItem?.realDurationText || currentItem?.walkingTime || '(도보 약 --초)';
  const isGoldenTime = typeof currentDist === 'number' && currentDist <= 300;

  return (
    <section className={`bottom-sheet ${isCollapsed ? 'collapsed' : ''}`} id="facilitySheet">
      {/* 바텀시트 상단 드래그 핸들 */}
      <div className="sheet-grip-area" onClick={onToggleCollapse}>
        <div className="grip-bar"></div>
      </div>

      {/* 접힘(미니) 상태 요약 바 */}
      {isCollapsed && currentItem && (
        <div className="mini-dock-bar" onClick={onToggleCollapse}>
          <div className="mini-lead">
            <span className="mini-distance">{currentDist}m</span>
            <span className="mini-name">{currentItem.name}</span>
          </div>
          <div className="mini-sub">
            <span className="mini-place">🏢 {currentItem.buildPlace || currentItem.buildAddress || '위치 상세 정보'}</span>
            <span className="mini-arrow">▲ 펼치기</span>
          </div>
        </div>
      )}

      {/* 펼침 상태 콘텐츠 */}
      {!isCollapsed && (
        <div className="sheet-content">
          {currentItem ? (
            <div className="emergency-hero-card">
              {/* 상단 거리 & 골든타임 헤더 */}
              <div className="hero-top-row">
                <div className="distance-metric">
                  <span className="val">{currentDist}</span>
                  <span className="unit">m</span>
                  <span className="eta">{currentDuration}</span>
                </div>
                <div className="hero-badges">
                  {isGoldenTime && (
                    <span className="badge golden-pill">🚨 골든타임 4분 내</span>
                  )}
                  {currentItem.category === 'aed' && currentItem.availableNow === false && (
                    <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                      🌙 현재 운영시간 외
                    </span>
                  )}
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
                  <span>건물 내부 상세 위치</span>
                </div>
                <div className="indoor-text">
                  {currentItem.buildPlace || currentItem.buildAddress || '상세 위치 정보가 등록되어 있지 않습니다.'}
                </div>
              </div>

              {/* 메타 정보 */}
              <div className="hero-meta-row">
                <span className="meta-txt">{currentItem.buildAddress || '-'}</span>
                <span className="meta-dot">·</span>
                <span className="meta-txt">{currentItem.org || '-'}</span>
                <span className="meta-dot">·</span>
                <span className="meta-txt">
                  {currentItem.installYear ? `${currentItem.installYear}년 설치 (${currentItem.age || 0}년 경과)` : '설치연도 미상'}
                </span>
              </div>

              {/* 액션 버튼 그룹 */}
              <div className="hero-action-grid">
                <a href="tel:119" className="btn-primary-119">
                  <span className="icon">🚨</span>
                  <span>119 긴급통화</span>
                </a>

                <button
                  type="button"
                  className="btn-action"
                  onClick={() => onStartNavigation(currentItem)}
                >
                  <span className="icon">🧭</span>
                  <span>도보 길안내</span>
                </button>

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
                  <span>관리처 통화</span>
                </a>

                <button
                  type="button"
                  className="btn-action subtle"
                  onClick={() => onOpenReport(currentItem)}
                >
                  <span className="icon">⚠️</span>
                  <span>현장 제보</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
              주변에 검색된 안전시설이 없습니다.
            </div>
          )}

          {/* 내 위치 미세 조정 안내 바 */}
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            padding: '8px 12px',
            margin: '0 16px 12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: '#166534',
            fontWeight: 500
          }}>
            <span style={{ fontSize: '15px' }}>💡</span>
            <span>내 위치 핀(파란 원)을 드래그하거나 지도 우클릭으로 정확한 아파트 동/호수로 위치를 맞출 수 있습니다.</span>
          </div>

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
                    onClick={() => onSelectFacility(facility)}
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
                        style={{
                          background: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
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
