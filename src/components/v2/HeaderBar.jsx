import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Info } from 'lucide-react';
import usePlaceSuggestions from '../../hooks/usePlaceSuggestions';
import PlaceSuggestions from './PlaceSuggestions';

/**
 * 위쪽 떠 있는 바: AED | 대피소 전환, 장소 검색, 안내
 * 지도 영역을 최대한 남기기 위해 버튼은 세 가지만 둔다.
 */
export default function HeaderBar({ category, onSelectCategory, onSearch, onPickPlace, searchBias, isSearching, onOpenInfo }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestions = usePlaceSuggestions(searchOpen ? keyword : '', searchBias);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions.results]);

  const closeSearch = () => {
    setSearchOpen(false);
    setKeyword('');
  };

  const pick = (place) => {
    onPickPlace(place);
    closeSearch();
  };

  // 엔터: 고른 후보 → 첫 후보 → (후보가 아직 없으면) 바로 검색
  const handleSubmit = (e) => {
    e.preventDefault();
    const value = keyword.trim();
    if (!value) return;
    const { results } = suggestions;
    if (results.length) {
      pick(results[activeIndex >= 0 ? activeIndex : 0]);
      return;
    }
    onSearch(value);
    closeSearch();
  };

  const handleKeyDown = (e) => {
    const count = suggestions.results.length;
    if (!count) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % count);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
    } else if (e.key === 'Escape') {
      closeSearch();
    }
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
            onKeyDown={handleKeyDown}
            autoComplete="off"
            enterKeyHint="search"
            role="combobox"
            aria-expanded={suggestions.results.length > 0}
            aria-controls="sm-search-suggest"
            aria-activedescendant={activeIndex >= 0 ? `sm-search-suggest-${activeIndex}` : undefined}
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
        onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
        aria-label={searchOpen ? '검색 닫기' : '장소나 주소 검색'}
      >
        {searchOpen ? <X size={22} strokeWidth={2.2} /> : <Search size={22} strokeWidth={2.2} />}
      </button>

      {!searchOpen && onOpenInfo && (
        <button type="button" className="sm-iconbtn" onClick={onOpenInfo} aria-label="출처와 이용 안내">
          <Info size={22} strokeWidth={2.2} />
        </button>
      )}

      {searchOpen && (
        <PlaceSuggestions id="sm-search-suggest" state={suggestions} activeIndex={activeIndex} onPick={pick} />
      )}
    </header>
  );
}
