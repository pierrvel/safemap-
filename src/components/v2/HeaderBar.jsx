import React, { useState } from 'react';
import { Search, Crosshair, X, Shield, Clock, Zap, Download } from 'lucide-react';

/**
 * 📱 모바일 세로모드 최적화 미니멀 상단 바
 * - 지도 영역을 85% 이상 확보하기 위한 극단적 미니멀 헤더
 * - '지금 개방' 원터치 필터로 야간 폐문 헛걸음 원천 차단
 */
export default function HeaderBar({
  category,
  onSelectCategory,
  openOnly,
  onToggleOpenOnly,
  counts = {},
  onSearch,
  onResetGps,
  isSearching,
  isStandalone = false,
  onOpenInstallModal,
}) {
  const [keyword, setKeyword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    onSearch(keyword.trim());
  };

  return (
    <header className="v2-top-header" role="banner">
      {/* 1. 슬림 브랜드 & 검색 캡슐 */}
      <div className="v2-search-capsule">
        <button
          type="button"
          className="v2-brand-badge"
          onClick={onResetGps}
          title="내 위치로 이동"
        >
          <span className="v2-live-indicator"></span>
          <span className="v2-brand-name">골든러너</span>
        </button>

        <form onSubmit={handleSubmit} className="v2-search-form">
          <Search size={15} className="v2-search-icon" />
          <input
            type="text"
            className="v2-search-input"
            placeholder="장소명 또는 도로명 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            autoComplete="off"
          />
          {keyword && (
            <button
              type="button"
              className="v2-search-clear"
              onClick={() => setKeyword('')}
            >
              <X size={13} />
            </button>
          )}
        </form>

        <button
          type="button"
          className="v2-btn-gps"
          onClick={onResetGps}
          title="내 GPS 위치로 지도 이동"
        >
          <Crosshair size={17} />
        </button>
      </div>

      {/* 2. 미니 가로 필터 칩 (지금 개방 원터치 지원) */}
      <div className="v2-filter-row">
        <button
          type="button"
          className={`v2-filter-chip ${category === 'all' && !openOnly ? 'active' : ''}`}
          onClick={() => {
            onSelectCategory('all');
            if (openOnly) onToggleOpenOnly();
          }}
        >
          <span>전체</span>
          <span className="v2-chip-count">{counts.total || 0}</span>
        </button>

        {/* 🌟 킬러 기능: 지금 개방된 AED만 보기 (야간 헛걸음 방지) */}
        <button
          type="button"
          className={`v2-filter-chip open-now ${openOnly ? 'active' : ''}`}
          onClick={onToggleOpenOnly}
        >
          <Clock size={13} className="v2-chip-icon" />
          <span>지금 이용 가능</span>
          <span className="v2-chip-count green">{counts.openAeds || counts.aed || 0}</span>
        </button>

        <button
          type="button"
          className={`v2-filter-chip aed ${category === 'aed' && !openOnly ? 'active' : ''}`}
          onClick={() => {
            onSelectCategory('aed');
            if (openOnly) onToggleOpenOnly();
          }}
        >
          <Zap size={13} className="v2-chip-icon" />
          <span>AED</span>
          <span className="v2-chip-count red">{counts.aed || 0}</span>
        </button>

        <button
          type="button"
          className={`v2-filter-chip shelter ${category === 'shelter' && !openOnly ? 'active' : ''}`}
          onClick={() => {
            onSelectCategory('shelter');
            if (openOnly) onToggleOpenOnly();
          }}
        >
          <Shield size={13} className="v2-chip-icon" />
          <span>대피소</span>
          <span className="v2-chip-count emerald">{counts.shelter || 0}</span>
        </button>

        {/* 📲 PWA 홈 화면 앱 설치 버튼 (단독 앱 실행 모드가 아닐 때 노출) */}
        {!isStandalone && onOpenInstallModal && (
          <button
            type="button"
            className="v2-filter-chip install-pwa-btn"
            onClick={onOpenInstallModal}
            title="스마트폰/PC 홈 화면에 앱 설치하기"
          >
            <Download size={13} className="v2-chip-icon install-icon" />
            <span>앱 설치</span>
          </button>
        )}
      </div>
    </header>
  );
}
