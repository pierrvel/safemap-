import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, ShieldCheck, Camera, Send } from 'lucide-react';
import { submitCheckin, submitReport } from '../../services/api';

/**
 * 📋 시민 참여 AED 현장 실사 점검 모달
 * - 배터리 정상 여부, 패드 유효기간, 보관함 잠금 상태 현장 확인 기록
 */
export default function AuditModal({ facility, isOpen, onClose, onSuccess }) {
  const [powerStatus, setPowerStatus] = useState('NORMAL'); // 'NORMAL' | 'ISSUE'
  const [padStatus, setPadStatus] = useState('NORMAL'); // 'NORMAL' | 'EXPIRED'
  const [lockStatus, setLockStatus] = useState('OPEN'); // 'OPEN' | 'LOCKED'
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !facility) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const hasIssue = powerStatus === 'ISSUE' || padStatus === 'EXPIRED' || lockStatus === 'LOCKED';
    const statusType = hasIssue ? 'ISSUE' : 'NORMAL';

    const detailNote = `[점검] 전원:${powerStatus === 'NORMAL' ? '정상(녹색불)' : '방전/경고음'} | 패드:${padStatus === 'NORMAL' ? '유효' : '만료의심'} | 보관함:${lockStatus === 'OPEN' ? '상시개방' : '잠금/폐쇄'} ${note ? `| 메모: ${note}` : ''}`;

    try {
      await submitCheckin(facility.id, statusType, detailNote);
      if (hasIssue) {
        await submitReport({
          facilityId: facility.id,
          facilityName: facility.name,
          category: facility.category,
          reportType: lockStatus === 'LOCKED' ? 'DAMAGED' : (powerStatus === 'ISSUE' ? 'DAMAGED' : 'EXPIRED'),
          details: detailNote,
          issueType: lockStatus === 'LOCKED' ? 'LOCKED_DOOR' : (powerStatus === 'ISSUE' ? 'BATTERY_DEAD' : 'EXPIRED_PAD'),
          description: detailNote,
        });
      }
      setSubmitting(false);
      onSuccess?.('ℹ️ 점검 기록이 시범 접수되었습니다. (공식 서비스 준비 중)');
      onClose();
    } catch (err) {
      setSubmitting(false);
      onSuccess?.('❌ 점검 정보 저장 중 오류가 발생했습니다.');
      onClose();
    }
  };

  return (
    <div className="v2-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="v2-audit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="v2-audit-header">
          <div className="v2-audit-lead">
            <ShieldCheck size={20} className="text-emerald-500" />
            <div>
              <h3 className="v2-audit-title">AED 현장 실사 점검</h3>
              <p className="v2-audit-sub">{facility.name}</p>
            </div>
          </div>
          <button type="button" className="v2-btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="v2-audit-form">
          {/* 공식 서비스 준비 중 안내 배너 */}
          <div style={{
            padding: '10px 14px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            fontSize: '0.76rem',
            color: '#1e40af',
            lineHeight: '1.45',
            marginBottom: '10px'
          }}>
            ℹ️ <strong>공식 서비스 준비 중</strong><br />
            시민 참여 실사 점검 기능은 관할 기관 자문 수렴 후 정식 연동될 예정입니다.
          </div>

          {/* 위치 정보 확인 */}
          <div className="v2-audit-facility-box">
            <span className="v2-audit-place-tag">등록 위치</span>
            <span className="v2-audit-place-name">{facility.buildPlace || facility.buildAddress || '위치 정보 없음'}</span>
          </div>

          {/* 1. 본체 전원/배터리 상태 */}
          <div className="v2-audit-field">
            <label className="v2-audit-label">1. 기기 전원 상태 (정상 시 녹색 깜빡임/OK 표시)</label>
            <div className="v2-chip-group">
              <button
                type="button"
                className={`v2-audit-chip ${powerStatus === 'NORMAL' ? 'active-green' : ''}`}
                onClick={() => setPowerStatus('NORMAL')}
              >
                <CheckCircle2 size={15} />
                <span>정상 (녹색 표시등)</span>
              </button>
              <button
                type="button"
                className={`v2-audit-chip ${powerStatus === 'ISSUE' ? 'active-red' : ''}`}
                onClick={() => setPowerStatus('ISSUE')}
              >
                <AlertTriangle size={15} />
                <span>방전 또는 점검 경고음</span>
              </button>
            </div>
          </div>

          {/* 2. 패드 유효기간 */}
          <div className="v2-audit-field">
            <label className="v2-audit-label">2. 전극 패드 유효기간 (표기 일자 기준)</label>
            <div className="v2-chip-group">
              <button
                type="button"
                className={`v2-audit-chip ${padStatus === 'NORMAL' ? 'active-green' : ''}`}
                onClick={() => setPadStatus('NORMAL')}
              >
                <CheckCircle2 size={15} />
                <span>유효기간 이내</span>
              </button>
              <button
                type="button"
                className={`v2-audit-chip ${padStatus === 'EXPIRED' ? 'active-red' : ''}`}
                onClick={() => setPadStatus('EXPIRED')}
              >
                <AlertTriangle size={15} />
                <span>만료되었거나 미표기</span>
              </button>
            </div>
          </div>

          {/* 3. 보관함 잠금 상태 (헛걸음 방지) */}
          <div className="v2-audit-field">
            <label className="v2-audit-label">3. 보관함 개방 여부 (야간/상시)</label>
            <div className="v2-chip-group">
              <button
                type="button"
                className={`v2-audit-chip ${lockStatus === 'OPEN' ? 'active-green' : ''}`}
                onClick={() => setLockStatus('OPEN')}
              >
                <CheckCircle2 size={15} />
                <span>상시 개방 (즉시 꺼냄 가능)</span>
              </button>
              <button
                type="button"
                className={`v2-audit-chip ${lockStatus === 'LOCKED' ? 'active-red' : ''}`}
                onClick={() => setLockStatus('LOCKED')}
              >
                <AlertTriangle size={15} />
                <span>자물쇠 잠금 / 폐쇄</span>
              </button>
            </div>
          </div>

          {/* 상세 메모 */}
          <div className="v2-audit-field">
            <label className="v2-audit-label">상세 메모 (선택)</label>
            <input
              type="text"
              className="v2-audit-input"
              placeholder="예: 경비실 우측 벽면으로 5m 이동되어 있음"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <button type="submit" className="v2-btn-submit-audit" disabled={submitting}>
            <Send size={16} />
            <span>{submitting ? '제출 중...' : '점검 기록 제출'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
