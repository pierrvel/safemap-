import React, { useEffect } from 'react';
import { Share, PlusSquare, MoreVertical } from 'lucide-react';

/**
 * 홈 화면에 추가 안내 (Android/PC는 브라우저 설치 창, iPhone은 단계 안내)
 */
export default function PwaInstallModal({ isOpen, onClose, deferredPrompt, onInstallNative, isIos }) {
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
        aria-labelledby="sm-install-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sm-install-title">홈 화면에 세이프맵 추가하기</h2>
        <p className="sm-dialog-lead">급할 때 브라우저를 열지 않고 아이콘 한 번으로 바로 열 수 있어요.</p>

        {deferredPrompt ? null : isIos ? (
          <ol className="sm-install-steps">
            <li><span>Safari 아래쪽의 공유 버튼 <Share size={18} aria-label="공유" />을 눌러요.</span></li>
            <li><span>목록에서 ‘홈 화면에 추가’ <PlusSquare size={18} aria-hidden="true" />를 골라요.</span></li>
            <li><span>오른쪽 위의 ‘추가’를 누르면 끝이에요.</span></li>
          </ol>
        ) : (
          <ol className="sm-install-steps">
            <li><span>브라우저의 메뉴 <MoreVertical size={18} aria-label="메뉴" />를 눌러요.</span></li>
            <li><span>‘앱 설치’ 또는 ‘홈 화면에 추가’를 골라요.</span></li>
          </ol>
        )}

        <div className="sm-dialog-actions">
          {deferredPrompt && (
            <button type="button" className="sm-btn-go sm-btn-ink" onClick={onInstallNative}>
              지금 추가하기
            </button>
          )}
          <button type="button" className="sm-btn-sec" onClick={onClose}>
            {deferredPrompt ? '나중에 할게요' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
