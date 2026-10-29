import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Safety Map Render Error:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Storage clear error:', e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '24px',
          textAlign: 'center',
          background: '#ffffff',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
            화면을 불러오지 못했어요
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '320px', lineHeight: '1.5', marginBottom: '20px' }}>
            저장된 이전 데이터와 충돌했을 수 있어요. 아래 버튼을 누르면 처음부터 다시 시작해요. 응급 상황이면 119에 먼저 전화해 주세요.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '12px 24px',
              background: '#191F28',
              color: '#ffffff',
              border: 'none',
              borderRadius: '18px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            다시 시작하기
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// 🫀 PWA Service Worker 등록 (앱 설치 및 오프라인/캐시 가속)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] 서비스 워커 정상 등록 완료 (Scope):', registration.scope);
      })
      .catch((error) => {
        console.warn('[PWA] 서비스 워커 등록 실패:', error);
      });
  });
}
