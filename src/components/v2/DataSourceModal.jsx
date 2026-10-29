import React, { useEffect } from 'react';

/**
 * 출처와 이용 안내: 데이터 출처·기준일, 응급 시 주의, 홈 화면 설치 진입
 */
export default function DataSourceModal({ isOpen, onClose, onOpenInstall }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="sm-dialog-backdrop" onClick={onClose}>
      <div
        className="sm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sm-info-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sm-info-title">세이프맵은 이렇게 만들어요</h2>
        <p className="sm-dialog-lead">
          공공데이터를 바탕으로 주변 AED와 민방위 대피소를 보여드려요. 사람이 쓰러졌다면 119에 먼저 전화해 주세요.
        </p>

        <div className="sm-dialog-section">
          <h3>데이터 출처</h3>
          <div className="sm-source">
            <strong>AED</strong>
            <span>국립중앙의료원 중앙응급의료센터 · 조회할 때마다 실시간으로 받아와요</span>
          </div>
          <div className="sm-source">
            <strong>민방위 대피소</strong>
            <span>행정안전부 민방위 대피시설 자료 · 2026년 10월 15일 기준</span>
          </div>
        </div>

        <div className="sm-dialog-section">
          <h3>알아 두세요</h3>
          <p className="sm-dialog-lead" style={{ fontSize: 15, marginTop: 6 }}>
            공공데이터의 좌표가 실제 건물과 어긋난 경우 주소로 다시 계산해 바로잡아요.
            그래도 공사·이전·잠금 때문에 현장과 다를 수 있어요.
          </p>
        </div>

        <div className="sm-dialog-actions">
          {onOpenInstall && (
            <button type="button" className="sm-btn-sec" onClick={onOpenInstall}>
              홈 화면에 세이프맵 추가하기
            </button>
          )}
          <button type="button" className="sm-btn-go sm-btn-ink" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
