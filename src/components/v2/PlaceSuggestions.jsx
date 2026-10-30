import React from 'react';
import { formatDistance } from '../../utils/format';

/**
 * 검색창 아래 장소 후보 목록: 이름·주소·거리를 보여주고 누르면 그 주변을 찾는다
 */
export default function PlaceSuggestions({ id, state, activeIndex, onPick, inline = false }) {
  const { status, results, query } = state;
  if (status === 'idle') return null;

  const showList = results.length > 0;
  return (
    <div className={`sm-suggest${inline ? ' is-inline' : ''}`}>
      {showList && (
        <ul id={id} className="sm-suggest-list" role="listbox" aria-label="장소 후보">
          {results.map((r, i) => (
            <li key={r.id} role="presentation">
              <button
                type="button"
                role="option"
                id={`${id}-${i}`}
                aria-selected={i === activeIndex}
                className="sm-suggest-row"
                // 입력창의 포커스가 먼저 빠지며 목록이 닫히지 않도록
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(r)}
              >
                <span className="sm-suggest-name">{r.name}</span>
                {Number.isFinite(r.distanceMeters) && (
                  <span className="sm-suggest-dist">{formatDistance(r.distanceMeters)}</span>
                )}
                {r.address && <span className="sm-suggest-addr">{r.address}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!showList && (
        <p className="sm-suggest-note" role="status">
          {status === 'empty' ? `‘${query}’ 결과가 없어요. 다른 이름이나 주소로 찾아보세요.` : '찾는 중이에요'}
        </p>
      )}
      {showList && (
        <span className="sm-visually-hidden" role="status">
          후보 {results.length}곳
        </span>
      )}
    </div>
  );
}
