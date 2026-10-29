import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { Phone, HeartPulse, Send, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import {
  walkMinutes,
  walkDistance,
  formatDistance,
  openState,
  OPEN_STATE_TEXT,
  placeTitle,
  placeOwner,
} from '../../utils/format';

export function CallButton({ className = 'sm-btn-119' }) {
  return (
    <a href="tel:119" className={className} aria-label="119에 전화하기">
      <Phone size={20} fill="currentColor" strokeWidth={0} aria-hidden="true" />
      <span>119</span>
    </a>
  );
}

export function CprButton({ onClick }) {
  return (
    <button type="button" className="sm-btn-sec" onClick={onClick}>
      <HeartPulse size={20} strokeWidth={2.2} className="sm-icon-aed" aria-hidden="true" />
      CPR 도와줘요
    </button>
  );
}

export function StateText({ facility }) {
  const state = openState(facility);
  return (
    <span className="sm-state">
      <span className={`sm-mark ${state}`} aria-hidden="true" />
      {OPEN_STATE_TEXT[state]}
    </span>
  );
}

const KIND_TEXT = { aed: 'AED', shelter: '대피소' };

function LocationNote({ facility }) {
  if (facility.locationConfidence === 'CHECK_NEEDED') return '주소로 위치를 추정했어요. 현장에서 한 번 더 확인해 주세요.';
  if (facility.calibrationType === 'SUB_LOCATION' || facility.calibrationType === 'BUILDING') {
    return facility.matchedPlaceName
      ? `공공데이터 좌표를 '${facility.matchedPlaceName}' 건물 위치로 바로잡았어요.`
      : '공공데이터 좌표를 실제 건물 위치로 바로잡았어요.';
  }
  if (facility.calibrationType === 'OUTLIER_RESTORED') return '잘못 등록된 좌표를 주소 기준으로 바로잡았어요.';
  return '공공데이터에 등록된 위치예요.';
}

/**
 * 하단 시트: 첫 화면의 답 하나와 행동 넷(119·안내·CPR·부탁)
 * - 답이 준비되기 전에는 자리만 보여주고, 한 번 그린 답은 저절로 바꾸지 않는다 (App이 보장)
 * - 위로 밀면 주변 목록, 아래로 밀거나 손잡이를 누르면 한 줄로 접혀 지도가 넓어진다
 */
export default function EmergencyBottomCard({
  category = 'aed',
  facility,
  facilities = [],
  answerReady,
  onStartNavigation,
  onOpenCpr,
  onShare,
  onSelectFacility,
  openAlternative = null,
  isOfflineView = false,
  onHeightChange,
  onCollapsedChange,
}) {
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const sheetRef = useRef(null);
  const touchStartY = useRef(null);
  const kind = KIND_TEXT[category] || 'AED';

  // 지도 버튼·화면 맞춤이 시트 높이를 알 수 있도록 전달
  useLayoutEffect(() => {
    if (!sheetRef.current || !onHeightChange) return undefined;
    const el = sheetRef.current;
    const report = () => onHeightChange(el.getBoundingClientRect().height);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange]);

  // 지도에서 다른 시설을 고르면 접힌 시트를 다시 펼쳐 답을 보여준다
  useEffect(() => {
    setDetailsOpen(false);
    setCollapsed(false);
  }, [facility?.id]);

  const canCollapse = answerReady && !!facility;
  const isCollapsed = collapsed && canCollapse && !expanded;

  useEffect(() => {
    onCollapsedChange?.(isCollapsed);
  }, [isCollapsed, onCollapsedChange]);
  useEffect(() => () => onCollapsedChange?.(false), [onCollapsedChange]);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    if (touchStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (delta < -40) {
      if (isCollapsed) setCollapsed(false);
      else if (facilities.length > 1) setExpanded(true);
    }
    if (delta > 40) {
      if (expanded) setExpanded(false);
      else if (canCollapse) setCollapsed(true);
    }
  };

  const handleGrab = () => {
    if (expanded) setExpanded(false);
    else if (canCollapse) setCollapsed((v) => !v);
  };

  const grab = (
    <button
      type="button"
      className="sm-grab"
      onClick={handleGrab}
      aria-label={expanded ? '목록 접기' : isCollapsed ? '카드 펼치기' : '카드 접고 지도 크게 보기'}
      aria-expanded={!isCollapsed}
    />
  );

  // 1. 답을 준비하는 중
  if (!answerReady) {
    return (
      <section ref={sheetRef} className="sm-sheet" aria-label={`가장 가까운 ${kind}`} aria-busy="true">
        {grab}
        <div className="sm-status-line" role="status">가장 가까운 {kind}를 찾고 있어요</div>
        <div className="sm-skeleton" style={{ height: 34, width: '82%', marginTop: 10 }} />
        <div className="sm-skeleton" style={{ height: 78, marginTop: 14, borderRadius: 18 }} />
        <div className="sm-actions">
          <CallButton />
          <button type="button" className="sm-btn-go" disabled>안내 시작</button>
        </div>
        {category === 'aed' && (
          <div className="sm-actions-2" style={{ gridTemplateColumns: '1fr' }}>
            <CprButton onClick={onOpenCpr} />
          </div>
        )}
      </section>
    );
  }

  // 2. 주변에 시설이 없음
  if (!facility) {
    return (
      <section ref={sheetRef} className="sm-sheet sm-sheet-enter" aria-label={`주변 ${kind}`}>
        {grab}
        <h2 className="sm-headline">반경 5km 안에서 {kind}를 찾지 못했어요</h2>
        <p className="sm-headline-sub">
          {category === 'aed'
            ? '119에 전화하면 가까운 AED 위치와 응급처치를 안내받을 수 있어요.'
            : '지도를 옮긴 뒤 다시 찾아보세요.'}
        </p>
        <div className="sm-actions">
          <CallButton />
          {category === 'aed' ? (
            <button type="button" className="sm-btn-go" onClick={onOpenCpr}>CPR 시작하기</button>
          ) : (
            <span />
          )}
        </div>
      </section>
    );
  }

  const minutes = walkMinutes(facility);
  const distance = walkDistance(facility);
  const owner = placeOwner(facility);
  const kakaoMapUrl = `https://map.kakao.com/link/to/${encodeURIComponent(placeTitle(facility))},${facility.lat},${facility.lon}`;

  // 3. 접힌 상태: 답 한 줄과 119만 남기고 지도를 넓게
  if (isCollapsed) {
    return (
      <section
        ref={sheetRef}
        className="sm-sheet"
        aria-label={`가장 가까운 ${kind}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {grab}
        <div className="sm-peek">
          <button type="button" className="sm-peek-body" onClick={() => setCollapsed(false)}>
            <span className="sm-peek-title">{kind}까지 걸어서 약 {minutes}분</span>
            <span className="sm-peek-meta">
              {placeTitle(facility)} · {formatDistance(distance)}
            </span>
          </button>
          <CallButton className="sm-btn-119 sm-btn-119-peek" />
        </div>
      </section>
    );
  }

  // 4. 주변 목록 (펼친 상태)
  if (expanded) {
    return (
      <section ref={sheetRef} className="sm-sheet" aria-label={`주변 ${kind} 목록`}>
        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>{grab}</div>
        <div className="sm-list-head">
          <h2 className="sm-headline" style={{ fontSize: 22 }}>주변 {kind} {facilities.length}곳</h2>
          <button type="button" className="sm-linkbtn" style={{ width: 'auto', marginTop: 0 }} onClick={() => setExpanded(false)}>
            접기 <ChevronDown size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="sm-sheet-scroll">
          <ul className="sm-list">
            {facilities.map((fac) => (
              <li key={fac.id}>
                <button
                  type="button"
                  className="sm-list-row"
                  aria-current={fac.id === facility.id}
                  onClick={() => {
                    onSelectFacility(fac);
                    setExpanded(false);
                  }}
                >
                  <span className="sm-list-title">{placeTitle(fac)}</span>
                  <span className="sm-list-time">
                    약 {walkMinutes(fac)}분
                    <small>{formatDistance(walkDistance(fac))}</small>
                  </span>
                  <span className="sm-list-meta">
                    <span>{placeOwner(fac)}</span>
                    {fac.category === 'aed' && <StateText facility={fac} />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="sm-note">
            {category === 'aed' ? 'AED 정보: 국립중앙의료원 실시간 자료' : '대피소 정보: 행정안전부 민방위 대피시설 자료'}
            {' · '}실제 현장과 다를 수 있어요.
          </p>
        </div>
      </section>
    );
  }

  // 5. 첫 화면의 답
  return (
    <section ref={sheetRef} className="sm-sheet sm-sheet-enter" aria-label={`가장 가까운 ${kind}`}>
      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {grab}
        <h2 className="sm-headline" aria-live="polite">
          {kind}까지 걸어서 약 {minutes}분
        </h2>
        {isOfflineView && (
          <p className="sm-headline-sub">
            인터넷이 끊겨 마지막 결과를 보여드려요{facility.direction ? ` · ${facility.direction} ${formatDistance(distance)}` : ''}
          </p>
        )}
      </div>

      <div className="sm-sheet-scroll">
        <button
          type="button"
          className="sm-place"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((v) => !v)}
        >
          <span className="sm-place-body">
            <span className="sm-place-title">{placeTitle(facility)}</span>
            <span className="sm-place-meta">
              <span className="sm-num">{formatDistance(distance)}</span>
              {owner && <span aria-hidden="true">·</span>}
              {owner && <span>{owner}</span>}
            </span>
            {category === 'aed' && (
              <span className="sm-place-meta">
                <StateText facility={facility} />
              </span>
            )}
          </span>
          <ChevronDown size={20} className="sm-place-chevron" aria-hidden="true" />
          <span className="sm-visually-hidden">{detailsOpen ? '자세한 정보 닫기' : '자세한 정보 보기'}</span>
        </button>

        {detailsOpen && (
          <div className="sm-details">
            <dl>
              {facility.buildAddress && (
                <>
                  <dt>주소</dt>
                  <dd>{facility.buildAddress}</dd>
                </>
              )}
              {category === 'aed' && facility.operatingHours && (
                <>
                  <dt>운영시간</dt>
                  <dd>{facility.operatingHours}</dd>
                </>
              )}
              {category === 'shelter' && (
                <>
                  <dt>개방</dt>
                  <dd>평소 개방 여부는 시설마다 달라요.</dd>
                </>
              )}
              <dt>위치</dt>
              <dd><LocationNote facility={facility} /></dd>
              <dt>길찾기</dt>
              <dd>
                <a href={kakaoMapUrl} target="_blank" rel="noopener noreferrer">카카오맵에서 열기</a>
              </dd>
            </dl>
          </div>
        )}

        {openAlternative && (
          <button type="button" className="sm-alt" onClick={() => onSelectFacility(openAlternative)}>
            <span className="sm-alt-body">
              <strong>확실히 열려 있는 AED도 있어요</strong>
              <span>{placeTitle(openAlternative)} · 걸어서 약 {walkMinutes(openAlternative)}분</span>
            </span>
            <ChevronRight size={20} color="#8B95A1" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="sm-actions">
        <CallButton />
        <button type="button" className="sm-btn-go" onClick={() => onStartNavigation(facility)}>
          안내 시작
        </button>
      </div>
      <div className="sm-actions-2" style={category === 'aed' ? undefined : { gridTemplateColumns: '1fr' }}>
        {category === 'aed' && <CprButton onClick={onOpenCpr} />}
        <button type="button" className="sm-btn-sec" onClick={() => onShare(facility)}>
          <Send size={19} strokeWidth={2.2} aria-hidden="true" />
          {category === 'aed' ? '옆 사람에게 부탁' : '위치 공유하기'}
        </button>
      </div>

      {facilities.length > 1 && (
        <button type="button" className="sm-linkbtn" onClick={() => setExpanded(true)}>
          주변 {kind} {facilities.length}곳 모두 보기 <ChevronUp size={18} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
