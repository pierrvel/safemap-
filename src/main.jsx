import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './v2.css';

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
          background: '#f8fafc',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚨</div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
            화면을 불러오는 중 일시적인 오류가 발생했습니다
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '320px', lineHeight: '1.5', marginBottom: '20px' }}>
            캐시된 이전 데이터와의 충돌일 수 있습니다. 아래 버튼을 눌러 최신 데이터로 다시 시작해주세요.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '12px 24px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
            }}
          >
            🔄 최신 상태로 새로고침
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
