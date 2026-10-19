import React from 'react';
import { X, Navigation, MapPin, Building2, Phone, AlertCircle, Clock, ShieldCheck } from 'lucide-react';

export default function FloatingDetailCard({
  facility,
  onClose,
  onStartNavigation,
  onOpenReport,
  isZenMode,
}) {
  if (!facility) return null;

  const isAed = facility.category === 'aed';
  const dist = facility.realDistanceMeters || facility.distanceMeters || 0;
  const durationText = facility.realDurationText || facility.walkingTime || '약 1분';
  const isGolden = dist <= 300;

  // 태그 목록 구성 (실제 존재하는 데이터만 엄밀히 표시)
  const tags = [];

  if (facility.available24h) {
    tags.push({ text: '24시간 운영', type: 'positive' });
  } else if (facility.availableNow === false) {
    tags.push({ text: '운영시간 외', type: 'warning' });
  } else if (facility.availableNow) {
    tags.push({ text: '현재 이용 가능', type: 'positive' });
  }

  if (facility.floorType) {
    tags.push({ text: `${facility.floorType}대피시설`, type: 'neutral' });
  } else if (facility.buildPlace && facility.buildPlace.includes('1층')) {
    tags.push({ text: '1층 설치', type: 'neutral' });
  } else if (facility.buildPlace && facility.buildPlace.includes('지하')) {
    tags.push({ text: '지하 설치', type: 'neutral' });
  } else {
    tags.push({ text: '공공시설', type: 'neutral' });
  }

  if (facility.capacity && facility.capacity > 0) {
    tags.push({ text: `수용 ${facility.capacity.toLocaleString()}명`, type: 'info' });
  }

  if (facility.verified) {
    tags.push({ text: '안심 검증', type: 'positive' });
  }

  return (
    <div
      className={`floating-detail-card desktop-only ${isZenMode ? 'zen-hidden' : ''}`}
      role="dialog"
      aria-label="시설 상세 정보"
    >
      {/* 1. 상단 아이콘 + 시설명 + 닫기 버튼 */}
      <div className="card-header-row">
        <div className={`card-badge-circle ${isAed ? 'aed' : 'shelter'}`}>
          {isAed ? (
            <span className="badge-emoji">⚡</span>
          ) : (
            <span className="badge-emoji">🏠</span>
          )}
        </div>

        <div className="card-title-group">
          <h3 className="card-title" title={facility.name}>
            {facility.name}
          </h3>
          <div className="card-meta-line">
            <span className={`cat-pill ${isAed ? 'aed' : 'shelter'}`}>
              {isAed ? 'AED' : '대피소'}
            </span>
            <span className="meta-sep">·</span>
            <span className="eta-txt">
              🏃 <strong>{dist}m</strong> ({durationText})
            </span>
            {isGolden && <span className="golden-tag">골든타임 4분 내</span>}
          </div>
        </div>

        <button
          type="button"
          className="btn-card-close"
          onClick={onClose}
          title="상세 카드 닫기"
        >
          <X size={18} />
        </button>
      </div>

      {/* 2. 상세 주소 및 건물 내 위치 */}
      <div className="card-body-section">
        {facility.buildAddress && (
          <div className="location-row address">
            <MapPin size={15} className="row-icon text-slate-400" />
            <span className="row-text">{facility.buildAddress}</span>
          </div>
        )}

        {facility.buildPlace && (
          <div className="location-row indoor">
            <Building2 size={15} className="row-icon text-blue-500" />
            <span className="row-text indoor-bold">{facility.buildPlace}</span>
          </div>
        )}

        {/* 3. 스마트 태그 행 */}
        <div className="card-tags-row">
          {tags.map((tag, idx) => (
            <span key={idx} className={`smart-tag ${tag.type}`}>
              {tag.text}
            </span>
          ))}
        </div>
      </div>

      {/* 4. 액션 버튼 영역 */}
      <div className="card-action-footer">
        <button
          type="button"
          className="btn-primary-route"
          onClick={() => onStartNavigation(facility)}
        >
          <Navigation size={17} className="route-icon" />
          <span>경로 안내</span>
        </button>

        <a
          href={facility.clerkTel ? `tel:${facility.clerkTel.replace(/[^0-9]/g, '')}` : 'tel:119'}
          className="btn-secondary-call"
          title="전화 문의 또는 119"
        >
          <Phone size={15} />
          <span>{facility.clerkTel ? '문의' : '119'}</span>
        </a>

        {onOpenReport && (
          <button
            type="button"
            className="btn-secondary-report"
            onClick={() => onOpenReport(facility)}
            title="위치 불일치 또는 고장 제보"
          >
            <AlertCircle size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
