import React from 'react';

export default function ClusterModal({
  cluster,
  onClose,
  onSelectFacility,
  selectedFacilityId,
}) {
  if (!cluster || cluster.length === 0) return null;

  const locTitle = cluster[0].org || cluster[0].buildAddress || '해당 위치';

  const getCatIcon = (cat) => {
    if (cat === 'extinguisher') return '🧯';
    if (cat === 'hydrant') return '💧';
    return '⚡';
  };

  return (
    <div className="cluster-popup-modal" onClick={(e) => e.stopPropagation()}>
      <div className="cluster-popup-header">
        <div className="cluster-header-text">
          <span>🏢</span>
          <span>{locTitle} ({cluster.length}대 밀집)</span>
        </div>
        <button type="button" className="btn-close-cluster" onClick={onClose} title="닫기">&times;</button>
      </div>

      <div className="cluster-popup-list">
        {cluster.map((item) => {
          const isSelected = selectedFacilityId === item.id;
          return (
            <div
              key={item.id}
              className={`cluster-item-card ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                onSelectFacility(item);
                onClose();
              }}
            >
              <div className="cluster-item-left">
                <div className="cluster-item-name">
                  <span>{getCatIcon(item.category)}</span> {item.name}
                </div>
                <div className="cluster-item-place">
                  📍 {item.buildPlace || item.buildAddress || '위치 상세 정보 없음'}
                </div>
              </div>
              <div className="cluster-item-right">
                <span className="cluster-item-dist">{item.realDistanceMeters || item.distanceMeters || 0}m</span>
                <span className="cluster-item-btn">{isSelected ? '선택됨' : '선택'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
