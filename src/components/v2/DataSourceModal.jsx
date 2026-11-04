import React, { useEffect, useState } from 'react';
import { REGIONS } from '../../utils/offlineStore';

const mb = (bytes) => `${Math.max(1, Math.round(bytes / 1048576))}MB`;

// 저장한 지역의 오프라인 지도 상태: 저장됨 / 받는 중 / 받기 버튼
function MapLine({ offline, region, isOnline }) {
  const { mapAvailable, maps, mapSizes, mapProgress, mapFailedRegion, downloadMap } = offline;
  if (!mapAvailable) return null;
  const saved = maps[region];
  if (saved) return <span className="sm-offline-map">지도 {mb(saved.bytes)} 저장됨</span>;
  if (mapProgress?.region === region) {
    return (
      <span className="sm-offline-map" role="status">
        지도 받는 중 {Math.round(mapProgress.ratio * 100)}%
      </span>
    );
  }
  const size = mapSizes[region];
  if (!size) return null;
  return (
    <span className="sm-offline-map">
      <button type="button" className="sm-offline-mapbtn" onClick={() => downloadMap(region)} disabled={!isOnline || !!mapProgress}>
        지도도 저장하기 ({mb(size)})
      </button>
      {mapFailedRegion === region && <span className="sm-offline-maperr">받지 못했어요. 다시 눌러 주세요.</span>}
    </span>
  );
}

const savedDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}월 ${d.getDate()}일 저장`;
};

/**
 * 인터넷 없이 쓰기: 저장한 지역 목록, 다른 지역 저장·지우기
 */
function OfflineSection({ offline, isOnline }) {
  const { saved, currentRegion, busyRegion, failedRegion, download, remove } = offline;
  const [pick, setPick] = useState('');
  const savedKeys = new Set(saved.map((r) => r.region));
  const choice = pick || REGIONS.find((r) => !savedKeys.has(r.key))?.key || '';

  return (
    <div className="sm-dialog-section">
      <h3>인터넷 없이 쓰기</h3>
      <p className="sm-offline-lead">
        저장한 지역은 인터넷이 끊겨도 가까운 AED와 대피소를 찾을 수 있어요. 지금 있는 지역은 자동으로 저장해요.
        {offline.mapAvailable && ' 지도까지 저장하면 인터넷이 없어도 길이 보이는 지도로 안내해요(와이파이에서 받기를 권해요).'}
      </p>

      {saved.length > 0 ? (
        <ul className="sm-offline-list">
          {saved.map((r) => (
            <li key={r.region} className="sm-offline-row">
              <span className="sm-offline-body">
                <strong>
                  {r.label}
                  {r.region === currentRegion && <span className="sm-offline-here">지금 있는 곳</span>}
                </strong>
                <span>
                  {busyRegion === r.region
                    ? '새로 저장하는 중이에요'
                    : [
                        r.aed && `AED ${r.aed.count.toLocaleString()}곳`,
                        r.shelter && `대피소 ${r.shelter.count.toLocaleString()}곳`,
                        savedDate((r.aed || r.shelter).updatedAt),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
                <MapLine offline={offline} region={r.region} isOnline={isOnline} />
              </span>
              <button type="button" className="sm-offline-remove" onClick={() => remove(r.region)} disabled={busyRegion === r.region}>
                지우기
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sm-offline-empty">{busyRegion ? '지금 있는 지역을 저장하는 중이에요.' : '아직 저장한 지역이 없어요.'}</p>
      )}

      <div className="sm-offline-add">
        <label htmlFor="sm-offline-region" className="sm-visually-hidden">저장할 지역</label>
        <select id="sm-offline-region" value={choice} onChange={(e) => setPick(e.target.value)}>
          {REGIONS.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
              {savedKeys.has(r.key) ? ' (다시 받기)' : ''}
            </option>
          ))}
        </select>
        <button type="button" className="sm-btn-sec" onClick={() => download(choice)} disabled={!isOnline || !!busyRegion || !choice}>
          {busyRegion === choice ? '저장하는 중' : '저장하기'}
        </button>
      </div>
      {!isOnline && <p className="sm-offline-note">인터넷에 연결되면 다른 지역을 저장할 수 있어요.</p>}
      {failedRegion && <p className="sm-offline-note" role="alert">저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.</p>}
    </div>
  );
}

/**
 * 출처와 이용 안내: 데이터 출처·기준일, 오프라인 자료, 응급 시 주의, 홈 화면 설치 진입
 */
export default function DataSourceModal({ isOpen, onClose, onOpenInstall, offline, isOnline = true }) {
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

        {offline && <OfflineSection offline={offline} isOnline={isOnline} />}

        <div className="sm-dialog-section">
          <h3>알아 두세요</h3>
          <p className="sm-dialog-lead" style={{ fontSize: 15, marginTop: 6 }}>
            공공데이터의 좌표가 실제 건물과 어긋난 경우 주소로 다시 계산해 바로잡아요.
            그래도 공사·이전·잠금 때문에 현장과 다를 수 있어요. 인터넷 없이 찾을 때는 저장해 둔 공공데이터 원래 좌표를 써요.
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
