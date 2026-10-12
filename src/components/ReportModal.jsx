import React, { useState } from 'react';

export default function ReportModal({
  facility,
  onClose,
  onSubmitReport,
}) {
  const [reportType, setReportType] = useState('MISSING');
  const [details, setDetails] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!facility) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSubmitReport({
      facilityId: facility.id,
      facilityName: facility.name,
      reportType,
      details,
      reporterName: reporterName.trim() || '익명 제보자',
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">⚠️</span>
            <h3>현장 정보 제보 및 정정 요청</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="report-target-summary">
          <strong>대상 시설:</strong> {facility.name} ({facility.categoryName || '안전시설'})
          <br />
          <span className="report-target-place">🏢 {facility.buildPlace || facility.buildAddress || '-'}</span>
        </div>

        <form onSubmit={handleSubmit} className="report-form">
          <label className="form-label">
            제보 유형
            <select
              className="form-select"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="MISSING">장비 없음 (실제 가보니 비치되어 있지 않음)</option>
              <option value="DAMAGED">장비 고장 / 파손 (사용 불가)</option>
              <option value="LOCATION_DIFF">상세 위치 불일치 (안내된 층/호수와 다름)</option>
              <option value="EXPIRED">패드 또는 내용연수 만료 의심</option>
            </select>
          </label>

          <label className="form-label">
            상세 내용 (선택)
            <textarea
              className="form-textarea"
              placeholder="예: 1층 안내데스크 뒤가 아니라 지하 1층 주차장 출입구 쪽에 위치해 있습니다."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />
          </label>

          <label className="form-label">
            제보자 성함 / 닉네임 (선택)
            <input
              type="text"
              className="form-input"
              placeholder="미입력 시 '익명 제보자'로 접수"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
            />
          </label>

          <div className="modal-btn-row">
            <button
              type="button"
              className="btn-modal-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn-modal-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? '접수 중...' : '제보 접수하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
