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
  isZenMode,
}) {
  const [keyword, setKeyword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    onSearch(keyword.trim());
  };

  return (
    <div className={`top-floating-bar ${isZenMode ? 'zen-hidden' : ''}`}>
      {/* 1. 단일 슬림 통합 검색 & 브랜드 바 (44px) */}
      <div className="slim-unified-bar">
        <div className="slim-brand" onClick={onResetGps} title="내 위치로 지도 리셋">
          <span className="live-dot"></span>
          <span className="brand-logo">🚨</span>
          <span className="brand-text">세이프맵</span>
        </div>

        <form onSubmit={handleSubmit} className="slim-search-form">
          <input
            type="text"
            className="slim-search-input"
            placeholder="장소·도로명 검색 (예: 시범한양, 서현고)"
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
            className="btn-slim-submit"
            disabled={isSearching}
            title="검색 위치로 이동"
          >
            <span>{isSearching ? '...' : '이동'}</span>
          </button>
        </form>

        <div className="slim-actions">
          <button
            type="button"
            className="btn-slim-gps"
            onClick={onResetGps}
            title="내 GPS 위치로 이동"
          >
            <span>📍</span>
          </button>
          <button
            type="button"
            className="btn-slim-tool"
            onClick={onOpenStats}
            title="데이터 품질 리포트"
          >
            <span>📊</span>
          </button>
        </div>
      </div>

      {/* 2. 컴팩트 가로 스크롤 필터 칩 & 안심 검증 토글 */}
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
            className={`chip ${category === 'shelter' ? 'active' : ''}`}
            onClick={() => onSelectCategory('shelter')}
          >
            <span className="legend-color-dot shelter"></span>
            <span className="chip-icon">🛡️</span>민방위 대피소 <b>{counts.shelter || 0}</b>
          </button>
        </div>

        <label className="verified-pill" title="고장 제보 또는 점검 필요 시설 제외">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={onToggleVerified}
          />
          <span className="verified-indicator"></span>
          <span>안심</span>
        </label>
      </div>
    </div>
  );
}
