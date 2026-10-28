import React from 'react';
import { X, AlertTriangle, Database, Calendar, Shield, ExternalLink } from 'lucide-react';

/**
 * ℹ️ 데이터 출처, 기준일 및 응급 주의사항 안내 모달
 */
export default function DataSourceModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="v2-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="v2-modal-container info-modal" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="v2-modal-header">
          <div className="v2-modal-title-row">
            <div className="v2-pwa-header-icon" style={{ background: '#fef3c7', borderColor: '#fde68a' }}>
              <Database size={20} className="text-amber-600" />
            </div>
            <div>
              <h3 className="v2-modal-title">데이터 출처 및 이용 안내</h3>
              <p className="v2-modal-sub">골든러너 119 데이터 기준일 및 주의사항</p>
            </div>
          </div>
          <button
            type="button"
            className="v2-btn-close-modal"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div className="v2-modal-body">
          {/* 1. 최우선 주의 문구 */}
          <div style={{
            background: '#fff1f2',
            border: '1.5px solid #fecdd3',
            borderRadius: '14px',
            padding: '14px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e11d48', fontWeight: '800', fontSize: '0.9rem' }}>
              <AlertTriangle size={18} />
              <span>응급 상황에서는 119 신고가 먼저입니다</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#4c0519', lineHeight: '1.45' }}>
              심정지 또는 재난 발생 시 즉시 <strong>119에 먼저 신고</strong>한 후, 구급대원 지시에 따라 AED 및 대피소를 탐색해 주세요.
            </p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: '#be123c', lineHeight: '1.4' }}>
              ※ 본 서비스에 표시된 시설 위치·운영시간은 공공데이터 원본 기반으로 실제 현장 상태와 다를 수 있습니다.
            </p>
          </div>

          {/* 2. 데이터 출처 및 기준일 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* AED 출처 */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: '800', color: '#0f172a' }}>⚡ 자동심장충격기 (AED)</span>
                <span style={{ fontSize: '0.68rem', fontWeight: '700', padding: '2px 6px', background: '#eff6ff', color: '#2563eb', borderRadius: '6px' }}>
                  실시간 API
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#475569', lineHeight: '1.45' }}>
                <strong>출처:</strong> 국립중앙의료원 중앙응급의료센터 (공공데이터포털)
              </p>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                <strong>기준일:</strong> 사용자 조회 시점 실시간 조회
              </p>
            </div>

            {/* 민방위 대피소 출처 */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: '800', color: '#0f172a' }}>🏠 민방위 대피소</span>
                <span style={{ fontSize: '0.68rem', fontWeight: '700', padding: '2px 6px', background: '#ecfdf5', color: '#059669', borderRadius: '6px' }}>
                  전국 데이터셋
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#475569', lineHeight: '1.45' }}>
                <strong>출처:</strong> 행정안전부 민방위대피시설 자료
              </p>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                <strong>기준일:</strong> 2026년 10월 15일 최신 갱신분
              </p>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="v2-modal-footer">
          <button
            type="button"
            className="v2-btn-close-full"
            onClick={onClose}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
