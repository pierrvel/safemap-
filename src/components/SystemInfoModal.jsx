import React from 'react';

export default function SystemInfoModal({ config, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">ℹ️</span>
            <h3>시스템 연동 및 환경 구성 안내</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="system-info-list">
          <div className="system-info-item">
            <div className="sys-lead">
              <span className="sys-dot online"></span>
              <strong>카카오맵 (Kakao Maps) 공식 SDK</strong>
            </div>
            <p>
              서버 환경변수(<code>KAKAO_MAP_API_KEY</code>)를 통해 프론트엔드로 안전하게 동적 로드되며, 고해상도 벡터 지도 및 장소 검색 서비스를 제공합니다.
            </p>
          </div>

          <div className="system-info-item">
            <div className="sys-lead">
              <span className={`sys-dot ${config?.hasDataGoKrKey ? 'online' : 'warn'}`}></span>
              <strong>공공데이터포털 실시간 AED 정보조회</strong>
            </div>
            <p>
              행정안전부 및 국립중앙의료원의 공식 전국 자동심장충격기(AED) 표준 데이터 API와 실시간 동기화됩니다.
            </p>
          </div>

          <div className="system-info-item">
            <div className="sys-lead">
              <span className="sys-dot online"></span>
              <strong>인앱 실시간 도보 내비게이션</strong>
            </div>
            <p>
              단순 직선거리가 아닌 실제 도로망(Foot routing) 기반의 도보 최단거리 및 턴바이턴 보행 가이드를 제공합니다.
            </p>
          </div>
        </div>

        <div className="modal-btn-row">
          <button type="button" className="btn-modal-submit" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
