import React, { useState, useRef, useEffect } from 'react';
import { CallButton, CprButton } from './EmergencyBottomCard';

/**
 * 위치가 없을 때의 첫 화면: 왜 위치가 필요한지 한 줄로 말하고,
 * 위치 없이도 119와 CPR은 바로 누를 수 있게 둔다.
 */
export default function LocationScreen({ status, onAllow, onSearch, isSearching, onOpenCpr }) {
  const denied = status === 'denied';
  const [searchOpen, setSearchOpen] = useState(denied);
  const [keyword, setKeyword] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (denied) setSearchOpen(true);
  }, [denied]);

  useEffect(() => {
    if (searchOpen && !denied) inputRef.current?.focus();
  }, [searchOpen, denied]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = keyword.trim();
    if (value) onSearch(value);
  };

  return (
    <div className="sm-screen" role="dialog" aria-modal="true" aria-labelledby="sm-location-title">
      <div className="sm-screen-brand">세이프맵</div>

      <div className="sm-screen-body">
        <h1 id="sm-location-title">
          {denied ? '위치를 확인하지 못했어요' : (
            <>가까운 AED를 찾으려면<br />지금 위치가 필요해요</>
          )}
        </h1>
        <p>
          {denied
            ? '장소나 주소를 입력하면 그 주변 AED를 찾아드릴게요. 내 위치를 쓰려면 브라우저 설정에서 위치를 허용해 주세요.'
            : '위치는 주변 AED를 찾는 데만 써요. 허용하면 바로 가장 가까운 곳을 알려드릴게요.'}
        </p>

        <div className="sm-screen-actions">
          {searchOpen && (
            <form className="sm-screen-search" onSubmit={handleSubmit} role="search">
              <label htmlFor="sm-location-search" className="sm-visually-hidden">장소나 주소</label>
              <input
                id="sm-location-search"
                ref={inputRef}
                type="search"
                placeholder="예: 강남역, 테헤란로 152"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                autoComplete="off"
                enterKeyHint="search"
              />
              <button type="submit" className="sm-search-submit" disabled={isSearching}>
                {isSearching ? '찾는 중' : '찾기'}
              </button>
            </form>
          )}
          {denied ? (
            <button type="button" className="sm-btn-sec" onClick={onAllow}>위치 다시 확인하기</button>
          ) : (
            <>
              <button type="button" className="sm-btn-go" onClick={onAllow}>위치 허용하기</button>
              {!searchOpen && (
                <button type="button" className="sm-btn-sec" onClick={() => setSearchOpen(true)}>
                  주소로 찾을게요
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="sm-screen-foot">
        <div className="sm-screen-foot-label">지금 응급 상황인가요?</div>
        <div className="sm-actions">
          <CallButton />
          <CprButton onClick={onOpenCpr} />
        </div>
      </div>
    </div>
  );
}
