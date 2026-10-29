import React, { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  CornerUpLeft,
  CornerUpRight,
  ArrowUp,
  ArrowUpRight,
  RotateCw,
  Flag,
  Footprints,
  Volume2,
  VolumeX,
  Info,
} from 'lucide-react';
import { calculateDistanceMeters } from '../../utils/mapIcons';
import { formatDistance, placeTitle, placeOwner } from '../../utils/format';
import { CallButton, CprButton } from './EmergencyBottomCard';

// 서버가 보내는 안내 기호를 선 아이콘으로 변환
const STEP_ICONS = {
  '↰': CornerUpLeft,
  '↱': CornerUpRight,
  '⬆️': ArrowUp,
  '↗️': ArrowUpRight,
  '🔄': RotateCw,
  '🎯': Flag,
};

// 음성으로 읽을 짧은 회전 안내
const STEP_PHRASES = {
  '↰': '좌회전',
  '↱': '우회전',
  '↗️': '갈림길에서 방향을 확인하세요',
  '🔄': '교차로를 통과하세요',
  '🎯': '목적지입니다',
};

const VOICE_PREF_KEY = 'safemap_voice_guide';
const VOICE_FAR_METERS = 150;
const VOICE_NEAR_METERS = 25;
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

function speak(text) {
  if (!canSpeak || !text) return;
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    utter.rate = 1.0;
    window.speechSynthesis.speak(utter);
  } catch (e) {
    // 음성 엔진 오류는 무시 (화면 안내는 계속)
  }
}

const ARRIVAL_RADIUS_METERS = 20;
const OFF_ROUTE_METERS = 50;

function findNearestIndex(path, lat, lon) {
  let bestIdx = 0;
  let bestDist = Infinity;
  path.forEach((pt, idx) => {
    const d = calculateDistanceMeters(lat, lon, pt.lat, pt.lng);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = idx;
    }
  });
  return { idx: bestIdx, dist: bestDist };
}

function minutesText(seconds) {
  return `약 ${Math.max(1, Math.round(seconds / 60))}분`;
}

// 서버 안내 문구에서 거리 반복을 덜어낸 짧은 문장
function shortInstruction(step) {
  if (!step?.instruction) return '경로를 따라 걸어가세요';
  return step.instruction.replace(/\s*후\s*\d+m\s*이동/, '').replace(/\d+m\s*이동/, '이동');
}

export default function NavigationHUD({
  navData,
  destination,
  currentPosition,
  onClose,
  onOpenCpr,
  onHeightChange,
  onArrivedChange,
}) {
  const panelRef = useRef(null);
  const path = useMemo(
    () => (navData?.coordinates || []).filter((pt) => pt && pt.lat !== undefined && pt.lng !== undefined),
    [navData]
  );

  const remainingFromIdx = useMemo(() => {
    const acc = new Array(path.length).fill(0);
    for (let i = path.length - 2; i >= 0; i--) {
      acc[i] = acc[i + 1] + calculateDistanceMeters(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
    }
    return acc;
  }, [path]);

  const stepsWithIdx = useMemo(
    () =>
      (navData?.steps || [])
        .filter((s) => s.location)
        .map((s) => ({ ...s, pathIdx: findNearestIndex(path, s.location.lat, s.location.lng).idx })),
    [navData, path]
  );

  const [voiceOn, setVoiceOn] = useState(() => {
    try {
      return localStorage.getItem(VOICE_PREF_KEY) !== 'off';
    } catch (e) {
      return true;
    }
  });
  const announcedRef = useRef(new Set());

  useLayoutEffect(() => {
    if (!panelRef.current || !onHeightChange) return undefined;
    const el = panelRef.current;
    const report = () => onHeightChange(el.getBoundingClientRect().height);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange]);

  const totalDist = navData?.distanceMeters ?? destination?.realDistanceMeters ?? destination?.distanceMeters ?? 0;
  const totalSec = navData?.durationSeconds ?? totalDist / 1.25;
  const speed = totalDist > 0 && totalSec > 0 ? totalDist / totalSec : 1.25;

  let remainingDist = totalDist;
  let nextStep = stepsWithIdx.find((s) => s.icon !== '🏁') || null;
  let nextStepDist = null;
  let isOffRoute = false;
  let hasArrived = false;

  if (destination && currentPosition && path.length > 1) {
    const { lat, lon } = currentPosition;
    const nearest = findNearestIndex(path, lat, lon);
    remainingDist = nearest.dist + remainingFromIdx[nearest.idx];
    isOffRoute = nearest.dist > OFF_ROUTE_METERS;
    hasArrived = calculateDistanceMeters(lat, lon, destination.lat, destination.lon) <= ARRIVAL_RADIUS_METERS;

    nextStep = stepsWithIdx.find((s) => s.pathIdx > nearest.idx) || null;
    if (nextStep) {
      nextStepDist = nearest.dist + remainingFromIdx[nearest.idx] - remainingFromIdx[nextStep.pathIdx];
    }
  }

  const StepIcon = (nextStep && STEP_ICONS[nextStep.icon]) || Footprints;
  const isAed = destination?.category !== 'shelter';
  const where = placeTitle(destination);

  // 경로가 새로 잡히면(재탐색 포함) 안내 이력 초기화 후 출발 안내
  useEffect(() => {
    announcedRef.current = new Set();
    if (!voiceOn || !navData || !destination) return;
    speak(`${where}까지 ${Math.round(totalDist)}미터, 안내를 시작할게요.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navData]);

  const nextStepKey = nextStep ? `${nextStep.stepIndex}` : null;
  const nextStepPhrase = nextStep ? STEP_PHRASES[nextStep.icon] : null;
  useEffect(() => {
    if (!voiceOn || !destination) return;
    const announce = (key, text) => {
      if (announcedRef.current.has(key)) return;
      announcedRef.current.add(key);
      speak(text);
    };

    if (hasArrived) {
      announce('arrive', isAed ? `도착했어요. ${where}에서 AED를 꺼내 주세요.` : `도착했어요. ${where}입니다.`);
      return;
    }
    if (isOffRoute) {
      announce(`offroute-${navData?.distanceMeters}`, '경로를 벗어났어요. 길을 다시 찾을게요.');
      return;
    }
    if (nextStepKey && nextStepPhrase && nextStepDist !== null) {
      if (nextStepDist <= VOICE_NEAR_METERS) {
        announce(`${nextStepKey}-near`, `곧 ${nextStepPhrase}`);
      } else if (nextStepDist <= VOICE_FAR_METERS) {
        announce(`${nextStepKey}-far`, `${Math.round(nextStepDist / 10) * 10}미터 앞에서 ${nextStepPhrase}`);
      }
    }
  }, [voiceOn, destination, hasArrived, isOffRoute, nextStepKey, nextStepPhrase, nextStepDist, navData, isAed, where]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  useEffect(() => {
    onArrivedChange?.(hasArrived);
  }, [hasArrived, onArrivedChange]);

  const toggleVoice = () => {
    setVoiceOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(VOICE_PREF_KEY, next ? 'on' : 'off');
      } catch (e) {
        // 저장 실패는 무시
      }
      if (!next) window.speechSynthesis?.cancel();
      return next;
    });
  };

  if (!destination) return null;

  return (
    <>
      {!hasArrived && (
        <div className="sm-nav-top" role="status" aria-live="polite">
          <span className="sm-nav-turn" aria-hidden="true">
            <StepIcon size={28} strokeWidth={2.2} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="sm-nav-step-dist">
              {nextStepDist !== null ? formatDistance(nextStepDist) : formatDistance(remainingDist)}
            </span>
            <span className="sm-nav-step-text">{nextStep ? shortInstruction(nextStep) : '목적지 방향으로 걸어가세요'}</span>
          </span>
          {canSpeak && (
            <button
              type="button"
              className="sm-nav-voice"
              onClick={toggleVoice}
              aria-label={voiceOn ? '음성 안내 끄기' : '음성 안내 켜기'}
              aria-pressed={voiceOn}
            >
              {voiceOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
            </button>
          )}
        </div>
      )}

      <section ref={panelRef} className="sm-sheet" aria-label="길안내">
        {hasArrived ? (
          <>
            <h2 className="sm-headline" style={{ marginTop: 12 }}>
              {isAed ? <>도착했어요.<br />이제 AED를 꺼내 주세요</> : '대피소에 도착했어요'}
            </h2>
            <div className="sm-place" style={{ cursor: 'default' }}>
              <span className="sm-place-body">
                <span className="sm-place-title">{where}</span>
                {placeOwner(destination) && <span className="sm-place-meta">{placeOwner(destination)}</span>}
              </span>
            </div>
            {isAed ? (
              <ol className="sm-steps">
                <li><div><strong>보관함 문을 열고 AED를 꺼내요</strong><span>경보음이 울릴 수 있어요. 괜찮아요.</span></div></li>
                <li><div><strong>환자 곁으로 돌아가요</strong><span>왔던 길로 돌아가면 돼요.</span></div></li>
                <li><div><strong>뚜껑을 열거나 전원 버튼을 눌러요</strong></div></li>
                <li><div><strong>AED 음성 안내를 그대로 따라요</strong></div></li>
              </ol>
            ) : (
              <p className="sm-headline-sub">입구의 대피소 표지를 따라 안으로 들어가세요.</p>
            )}
            <div className="sm-actions">
              <CallButton />
              {isAed ? <CprButton onClick={onOpenCpr} /> : <span />}
            </div>
            <button type="button" className="sm-linkbtn" onClick={onClose}>안내 끝내기</button>
          </>
        ) : (
          <>
            <div style={{ marginTop: 8 }}>
              <h2 className="sm-headline" style={{ fontSize: 22 }}>
                <span className="sm-num">{formatDistance(remainingDist)}</span> 남았어요 · {minutesText(remainingDist / speed)}
              </h2>
              <p className="sm-headline-sub">{where}</p>
            </div>
            {(isOffRoute || navData?.isRealRoad === false) && (
              <div className="sm-nav-warn" role="status">
                <Info size={18} style={{ flex: 'none', marginTop: 2 }} aria-hidden="true" />
                <span>
                  {isOffRoute
                    ? '경로에서 벗어났어요. 지금 위치에서 길을 다시 찾을게요.'
                    : '걷는 길을 불러오지 못해 방향만 안내해요. 지도를 함께 봐 주세요.'}
                </span>
              </div>
            )}
            <div className="sm-actions">
              <CallButton />
              <button type="button" className="sm-btn-sec" style={{ height: 58 }} onClick={onClose}>
                안내 끝내기
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
