import React from 'react';

export default function StatsModal({ stats, onClose }) {
  if (!stats) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">📊</span>
            <h3>데이터 전처리 및 안심 품질 리포트</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <p className="modal-desc">
          공공데이터(행정안전부·국립중앙의료원) 원천 데이터의 결측치 정제 및 최신성 검증 현황입니다.
        </p>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">원천 수집 데이터</span>
            <span className="stat-val">{stats.totalCollected || 0}건</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">좌표 결측치 정제</span>
            <span className="stat-val text-green">{stats.missingCoordsFixed || 0}건</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">중복 데이터 병합</span>
            <span className="stat-val text-blue">{stats.duplicatesRemoved || 0}건</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">시민 제보 반영</span>
            <span className="stat-val text-amber">{stats.userReportedExcluded || 0}건</span>
          </div>
          <div className="stat-card highlight">
            <span className="stat-label">최종 신뢰 가용 시설</span>
            <span className="stat-val text-primary">{stats.finalUsableCount || 0}건</span>
          </div>
        </div>

        <div className="modal-btn-row">
          <button type="button" className="btn-modal-submit" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
