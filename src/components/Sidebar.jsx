import React, { useState } from 'react';
import {
  Shield,
  Search,
  Crosshair,
  Grid,
  Heart,
  Home,
  CheckCircle2,
  ChevronRight,
  Navigation,
  X,
  Sparkles,
} from 'lucide-react';

export default function Sidebar({
  category,
  onSelectCategory,
  verifiedOnly,
  onToggleVerified,
  counts = {},
  facilities = [],
  selectedFacility,
  onSelectFacility,
  onSearch,
  onResetGps,
  onOpenStats,
  onOpenSystemInfo,
  isSearching,
}) {
  const [keyword, setKeyword] = useState('');
  const [showAllList, setShowAllList] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    onSearch(keyword.trim());
  };

  const visibleFacilities = showAllList ? facilities : facilities.slice(0, 6);

  return (
    <aside className="liquid-sidebar desktop-only" aria-label="안전시설 탐색 패널">
      {/* 1. 상단 브랜드 헤더 */}
      <div className="sidebar-brand-header">
        <div className="brand-icon-box">
          <Shield className="w-6 h-6 text-white" fill="currentColor" />
        </div>
        <div className="brand-text-group">
          <h1 className="brand-title">골든타임 세이프맵</h1>
          <p className="brand-subtitle">긴급 안전시설 탐색 &amp; 도보 길안내</p>
        </div>
        <div className="brand-tool-group">
          <button
            type="button"
            className="btn-glass-icon"
            onClick={onOpenStats}
            title="데이터 품질 분석 리포트"
          >
            📊
          </button>
          <button
            type="button"
            className="btn-glass-icon"
            onClick={onOpenSystemInfo}
            title="시스템 환경 정보"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* 2. Apple Liquid Glass 검색창 */}
      <form onSubmit={handleSubmit} className="sidebar-search-box">
        <Search className="search-icon" size={17} />
        <input
          type="text"
          className="search-input"
          placeholder="시설명 또는 지역을 검색하세요"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          autoComplete="off"
        />
        {keyword && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => setKeyword('')}
            title="검색어 지우기"
          >
            <X size={14} />
          </button>
        )}
        <button
          type="button"
          className="search-gps-btn"
          onClick={onResetGps}
          title="현재 GPS 위치로 이동"
        >
          <Crosshair size={17} />
        </button>
      </form>

      {/* 3. 시설 카테고리 필터 탭 */}
      <div className="sidebar-filter-tabs" role="tablist">
        <button
          type="button"
          className={`filter-tab-pill ${category === 'all' ? 'active' : ''}`}
          onClick={() => onSelectCategory('all')}
        >
          <Grid size={14} />
          <span>전체</span>
          <span className="count-badge">{counts.total || 0}</span>
        </button>

        <button
          type="button"
          className={`filter-tab-pill aed ${category === 'aed' ? 'active' : ''}`}
          onClick={() => onSelectCategory('aed')}
        >
          <span className="dot aed"></span>
          <span>AED</span>
          <span className="count-badge">{counts.aed || 0}</span>
        </button>

        <button
          type="button"
          className={`filter-tab-pill shelter ${category === 'shelter' ? 'active' : ''}`}
          onClick={() => onSelectCategory('shelter')}
        >
          <span className="dot shelter"></span>
          <span>대피소</span>
          <span className="count-badge">{counts.shelter || 0}</span>
        </button>
      </div>

      {/* 안심 검증 토글 */}
      <div className="sidebar-verified-row">
        <label className="verified-toggle-label">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={onToggleVerified}
          />
          <span className="verified-switch"></span>
          <span className="verified-text">
            <CheckCircle2 size={13} className="text-emerald-500 inline mr-1" />
            안심 검증 시설만 보기 (노후·고장 제외)
          </span>
        </label>
      </div>

      {/* 4. 주변 안전시설 목록 */}
      <div className="sidebar-facilities-section">
        <div className="section-title-row">
          <h2 className="section-title">주변 안전시설</h2>
          <span className="section-count">총 {facilities.length}개</span>
        </div>

        <div className="facilities-scroll-list" role="list">
          {facilities.length === 0 ? (
            <div className="empty-facilities-box">
              <span className="empty-icon">📍</span>
              <p>주변에 검색된 안전시설이 없습니다.</p>
              <span className="empty-sub">다른 위치로 지도를 이동해보세요.</span>
            </div>
          ) : (
            visibleFacilities.map((fac) => {
              const isSelected = selectedFacility?.id === fac.id;
              const isAed = fac.category === 'aed';
              const dist = fac.realDistanceMeters || fac.distanceMeters || 0;
              const durationTxt = fac.realDurationText || fac.walkingTime || '';

              return (
                <div
                  key={fac.id}
                  className={`facility-item-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectFacility(fac)}
                  role="button"
                  tabIndex={0}
                >
                  <div className={`item-icon-circle ${isAed ? 'aed' : 'shelter'}`}>
                    {isAed ? (
                      <span className="icon-symbol">⚡</span>
                    ) : (
                      <span className="icon-symbol">🏠</span>
                    )}
                  </div>

                  <div className="item-info-group">
                    <div className="item-name-row">
                      <span className="item-name" title={fac.name}>{fac.name}</span>
                      {fac.availableNow === false && isAed && (
                        <span className="status-tag night">야간외</span>
                      )}
                      {fac.locationConfidence === 'CALIBRATED' && (
                        <span className="status-tag calibrated">정밀교정</span>
                      )}
                    </div>
                    <div className="item-sub-desc">
                      <span className="cat-prefix">{isAed ? 'AED' : '대피소'}</span>
                      <span className="dot-sep">·</span>
                      <span className="addr-txt" title={fac.buildAddress || fac.buildPlace}>
                        {fac.buildAddress || fac.buildPlace}
                      </span>
                    </div>
                  </div>

                  <div className="item-dist-group">
                    <span className="dist-num">{dist}m</span>
                    <ChevronRight size={14} className="chevron" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {facilities.length > 6 && (
          <button
            type="button"
            className="btn-list-more"
            onClick={() => setShowAllList((prev) => !prev)}
          >
            <span>{showAllList ? '접기 ∧' : `더보기 (${facilities.length - 6}개 더보기) ∨`}</span>
          </button>
        )}
      </div>

      {/* 5. 하단 현재 위치로 이동 버튼 */}
      <div className="sidebar-bottom-action">
        <button
          type="button"
          className="btn-current-location"
          onClick={onResetGps}
        >
          <div className="btn-lead">
            <span className="location-pin">📍</span>
            <span className="btn-label">현재 위치로 이동</span>
          </div>
          <Navigation size={16} className="nav-arrow" />
        </button>
      </div>
    </aside>
  );
}
