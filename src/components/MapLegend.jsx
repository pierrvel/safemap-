import React from 'react';

export default function MapLegend({ isZenMode }) {
  return (
    <div className={`map-legend-pill ${isZenMode ? 'zen-hidden' : ''}`} aria-label="지도 범례">
      <div className="legend-item">
        <span className="legend-symbol aed">⚡</span>
        <span className="legend-label">AED</span>
      </div>
      <div className="legend-divider"></div>
      <div className="legend-item">
        <span className="legend-symbol shelter">🏠</span>
        <span className="legend-label">대피소</span>
      </div>
      <div className="legend-divider"></div>
      <div className="legend-item">
        <span className="legend-symbol current-user">
          <span className="radar-core"></span>
        </span>
        <span className="legend-label">현재 위치</span>
      </div>
    </div>
  );
}
