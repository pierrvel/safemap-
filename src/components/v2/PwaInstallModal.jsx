import React from 'react';
import {
  Download,
  Share,
  PlusSquare,
  Sparkles,
  X,
  Smartphone,
  Monitor,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

/**
 * 📲 골든러너 119 PWA(Progressive Web App) 설치 안내 모달
 * - Android, iPhone(iOS Safari), PC(Windows/Mac) 맞춤형 원터치/단계별 설치 가이드
 * - 네이티브 앱스토어 다운로드 없이 홈 화면에 단독 앱으로 설치
 */
export default function PwaInstallModal({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallNative,
  isIos,
  isAndroid,
}) {
  if (!isOpen) return null;

  return (
    <div className="v2-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="v2-modal-container pwa-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="v2-modal-header">
          <div className="v2-modal-title-row">
            <div className="v2-pwa-header-icon">
              <Smartphone size={22} className="text-blue" />
            </div>
            <div>
              <h3 className="v2-modal-title">골든러너 119 앱 설치</h3>
              <p className="v2-modal-sub">홈 화면에 추가하여 앱스토어 앱처럼 사용하세요</p>
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

        {/* 모달 본문 */}
        <div className="v2-modal-body pwa-body">
          {/* 1. 앱 카드 프리뷰 */}
          <div className="v2-pwa-preview-card">
            <img
              src="/icons/icon-192.png"
              alt="골든러너 119 앱 아이콘"
              className="v2-pwa-app-icon"
            />
            <div className="v2-pwa-app-info">
              <div className="v2-pwa-app-title">골든러너 119</div>
              <div className="v2-pwa-app-desc">심정지 4분 골든타임 사수 내비게이션</div>
              <div className="v2-pwa-badges">
                <span className="v2-pwa-mini-badge">단독 창 실행</span>
                <span className="v2-pwa-mini-badge">초경량 1.5MB</span>
                <span className="v2-pwa-mini-badge">실시간 GPS</span>
              </div>
            </div>
          </div>

          {/* 2. 장점 하이라이트 3개 */}
          <div className="v2-pwa-benefits-grid">
            <div className="v2-pwa-benefit-item">
              <div className="v2-pwa-benefit-dot">⚡</div>
              <div className="v2-pwa-benefit-text">
                <strong>1초 긴급 실행</strong>
                <span>주소창 없이 홈 화면 아이콘 터치 즉시 실행</span>
              </div>
            </div>
            <div className="v2-pwa-benefit-item">
              <div className="v2-pwa-benefit-dot">📴</div>
              <div className="v2-pwa-benefit-text">
                <strong>오프라인 고속 캐싱</strong>
                <span>재방문 시 로딩 지연 없는 즉각 반응</span>
              </div>
            </div>
            <div className="v2-pwa-benefit-item">
              <div className="v2-pwa-benefit-dot">🎯</div>
              <div className="v2-pwa-benefit-text">
                <strong>전체 화면 지도</strong>
                <span>브라우저 툴바 없이 넓은 지도 시야 확보</span>
              </div>
            </div>
          </div>

          {/* 3. 기기별 맞춤 설치 가이드 */}
          <div className="v2-pwa-guide-box">
            {/* Case A: Android 또는 PC에서 브라우저 네이티브 설치 프롬프트가 지원되는 경우 */}
            {deferredPrompt && (
              <div className="v2-pwa-native-prompt-section">
                <button
                  type="button"
                  className="v2-btn-pwa-install-primary"
                  onClick={onInstallNative}
                >
                  <Download size={18} />
                  <span>지금 바로 홈 화면에 설치하기</span>
                </button>
                <p className="v2-pwa-native-sub">
                  버튼을 누르면 브라우저의 공식 앱 설치 창이 열립니다.
                </p>
              </div>
            )}

            {/* Case B: iPhone / iPad (iOS Safari) 전용 설치 3단계 안내 */}
            {isIos && (
              <div className="v2-pwa-ios-guide">
                <div className="v2-pwa-guide-title">
                  <span className="v2-ios-apple-icon"></span>
                  <span>iPhone / iPad 홈 화면 추가 방법</span>
                </div>
                <div className="v2-pwa-steps-list">
                  <div className="v2-pwa-step">
                    <span className="v2-pwa-step-num">1</span>
                    <div className="v2-pwa-step-desc">
                      사파리(Safari) 화면 하단(또는 상단)의{' '}
                      <strong className="text-blue">
                        공유 버튼 [<Share size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />]
                      </strong>
                      을 터치합니다.
                    </div>
                  </div>
                  <div className="v2-pwa-step">
                    <span className="v2-pwa-step-num">2</span>
                    <div className="v2-pwa-step-desc">
                      메뉴를 아래로 내려{' '}
                      <strong className="text-blue">
                        '홈 화면에 추가' [<PlusSquare size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />]
                      </strong>
                      를 선택합니다.
                    </div>
                  </div>
                  <div className="v2-pwa-step">
                    <span className="v2-pwa-step-num">3</span>
                    <div className="v2-pwa-step-desc">
                      우측 상단의 <strong className="text-blue">'추가'</strong> 버튼을 누르면 홈 화면에 앱이 완성됩니다!
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Case C: 일반 안드로이드 브라우저(크롬, 삼성인터넷)에서 프롬프트가 대기 중이 아닐 때 수동 안내 */}
            {!deferredPrompt && !isIos && (
              <div className="v2-pwa-manual-guide">
                <div className="v2-pwa-guide-title">
                  <Smartphone size={16} className="text-blue" />
                  <span>브라우저 메뉴에서 간편 설치</span>
                </div>
                <div className="v2-pwa-steps-list">
                  <div className="v2-pwa-step">
                    <span className="v2-pwa-step-num">1</span>
                    <div className="v2-pwa-step-desc">
                      브라우저 우측 상단/하단의 <strong className="text-blue">더보기 메뉴 (⋮ 또는 ≡)</strong>를 누릅니다.
                    </div>
                  </div>
                  <div className="v2-pwa-step">
                    <span className="v2-pwa-step-num">2</span>
                    <div className="v2-pwa-step-desc">
                      <strong className="text-blue">'앱 설치'</strong> 또는 <strong className="text-blue">'현재 페이지 추가 &gt; 홈 화면'</strong>을 선택합니다.
                    </div>
                  </div>
                </div>
                <div className="v2-pwa-pc-hint">
                  <Monitor size={14} />
                  <span>PC(Chrome/Edge)의 경우 상단 주소창 우측의 <strong>설치 아이콘(⊕)</strong>을 눌러주세요.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 모달 푸터 */}
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
