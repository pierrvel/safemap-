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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">🏢</span>
            <h3>{locTitle} ({cluster.length}대 밀집)</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <p className="modal-desc">
          같은 건물 또는 반경 26m 내에 위치한 시설 목록입니다. 확인하려는 장비를 선택하세요.
        </p>

        <div className="cluster-modal-list">
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
                <div className="cluster-item-lead">
                  <span className="cluster-cat-icon">{getCatIcon(item.category)}</span>
                  <div className="cluster-names">
                    <h4>{item.name}</h4>
                    <p>🏢 {item.buildPlace || item.buildAddress || '상세 위치 정보 없음'}</p>
                  </div>
                </div>
                <div className="cluster-item-meta">
                  <span className="cluster-dist">{item.realDistanceMeters || item.distanceMeters || 0}m</span>
                  <button type="button" className="btn-cluster-pick">선택</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
