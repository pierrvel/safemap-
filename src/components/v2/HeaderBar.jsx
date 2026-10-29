import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Info } from 'lucide-react';

/**
 * 위쪽 떠 있는 바: AED | 대피소 전환, 장소 검색, 안내
 * 지도 영역을 최대한 남기기 위해 버튼은 세 가지만 둔다.
 */
export default function HeaderBar({ category, onSelectCategory, onSearch, isSearching, onOpenInfo }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = keyword.trim();
    if (!value) return;
    onSearch(value);
    setSearchOpen(false);
    setKeyword('');
  };

  return (
    <header className="sm-topbar">
      {searchOpen ? (
        <form className="sm-search" onSubmit={handleSubmit} role="search">
          <label htmlFor="sm-search-input" className="sm-visually-hidden">장소나 주소 검색</label>
          <input
            id="sm-search-input"
            ref={inputRef}
            type="search"
            placeholder="장소나 주소로 위치 지정"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" className="sm-search-submit" disabled={isSearching}>
            {isSearching ? '찾는 중' : '찾기'}
          </button>
        </form>
      ) : (
        <div className="sm-seg" role="group" aria-label="찾을 시설">
          <button
            type="button"
            aria-pressed={category === 'aed'}
            onClick={() => onSelectCategory('aed')}
          >
            AED
          </button>
          <button
            type="button"
            aria-pressed={category === 'shelter'}
            onClick={() => onSelectCategory('shelter')}
          >
            대피소
          </button>
        </div>
      )}

      <button
        type="button"
        className="sm-iconbtn"
        onClick={() => setSearchOpen((open) => !open)}
        aria-label={searchOpen ? '검색 닫기' : '장소나 주소 검색'}
      >
        {searchOpen ? <X size={22} strokeWidth={2.2} /> : <Search size={22} strokeWidth={2.2} />}
      </button>

      {!searchOpen && onOpenInfo && (
        <button type="button" className="sm-iconbtn" onClick={onOpenInfo} aria-label="출처와 이용 안내">
          <Info size={22} strokeWidth={2.2} />
        </button>
      )}
    </header>
  );
}
