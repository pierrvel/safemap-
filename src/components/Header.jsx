import React, { useState } from 'react';

export default function Header({
  category,
  onSelectCategory,
  verifiedOnly,
  onToggleVerified,
  counts,
  onSearch,
  onResetGps,
  onOpenStats,
  onOpenSystemInfo,
  isSearching,
}) {
  const [keyword, setKeyword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    onSearch(keyword.trim());
  };

  return (
    <div className="top-floating-bar">
      {/* 상단 헤더 알약 */}
      <header className="header-pill">
        <div className="brand">
          <span className="live-dot"></span>
          <span className="brand-title">세이프맵</span>
          <span className="sdk-tag" id="sdkStatusBadge">카카오맵</span>
        </div>
        <div className="header-tools">
          <button
            type="button"
            className="tool-btn"
            onClick={onOpenStats}
            title="데이터 검증 및 품질 리포트"
          >
            <span>📊</span>
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={onOpenSystemInfo}
            title="시스템 및 API 상태 정보"
          >
            <span>ℹ️</span>
          </button>
        </div>
      </header>

      {/* 위치 검색창 & 실제 GPS 이동 버튼 */}
      <div className="search-box-pill">
        <form onSubmit={handleSubmit} className="search-input-wrap" style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="장소·도로명·역 검색 (예: 강남역, 시청역, 광화문)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            autoComplete="off"
          />
          {keyword && (
            <button
              type="button"
              className="btn-clear-search"
              onClick={() => setKeyword('')}
              title="검색어 지우기"
            >
              &times;
            </button>
          )}
          <button
            type="submit"
            className="btn-search-go"
            disabled={isSearching}
            title="입력 위치로 이동"
          >
            <span>{isSearching ? '...' : '이동'}</span>
          </button>
        </form>
        <button
          type="button"
          className="btn-gps-direct"
          onClick={onResetGps}
          title="실제 GPS 위치로 이동"
        >
          <span>📍 내 GPS</span>
        </button>
      </div>

      {/* 카테고리 필터 칩 & 안심 토글 바 */}
      <div className="filter-chips-row">
        <div className="chips-group" role="tablist">
          <button
            type="button"
            className={`chip ${category === 'all' ? 'active' : ''}`}
            onClick={() => onSelectCategory('all')}
          >
            <span className="chip-dot"></span>전체 <b>{counts.total || 0}</b>
          </button>
          <button
            type="button"
            className={`chip ${category === 'aed' ? 'active' : ''}`}
            onClick={() => onSelectCategory('aed')}
          >
            <span className="legend-color-dot aed"></span>
            <span className="chip-icon">⚡</span>AED <b>{counts.aed || 0}</b>
          </button>
          <button
            type="button"
            className={`chip ${category === 'extinguisher' ? 'active' : ''}`}
            onClick={() => onSelectCategory('extinguisher')}
          >
            <span className="legend-color-dot ext"></span>
            <span className="chip-icon">🧯</span>소화기 <b>{counts.extinguisher || 0}</b>
          </button>
          <button
            type="button"
            className={`chip ${category === 'hydrant' ? 'active' : ''}`}
            onClick={() => onSelectCategory('hydrant')}
          >
            <span className="legend-color-dot hyd"></span>
            <span className="chip-icon">💧</span>소화전 <b>{counts.hydrant || 0}</b>
          </button>
        </div>

        <label className="verified-pill" title="10년 경과 노후 소화기, 미점검/야간폐쇄 AED 제외">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={onToggleVerified}
          />
          <span className="verified-indicator"></span>
          <span>안심검증</span>
        </label>
      </div>
    </div>
  );
}
