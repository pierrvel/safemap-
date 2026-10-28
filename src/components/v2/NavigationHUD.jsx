import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Navigation,
  X,
  Phone,
  CornerUpLeft,
  CornerUpRight,
  ArrowUp,
  ArrowUpRight,
  RotateCw,
  Flag,
  Footprints,
  AlertTriangle,
  Building,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { calculateDistanceMeters } from '../../utils/mapIcons';

// 서버가 보내는 안내 기호를 앱 공통 선 아이콘으로 변환
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

const VOICE_PREF_KEY = 'goldenrunner_voice_guide';
const VOICE_FAR_METERS = 150;
const VOICE_NEAR_METERS = 25;
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

function speak(text) {
  if (!canSpeak || !text) return;
  try {
    // 이전 안내가 끝난 뒤 이어서 읽도록 대기열에 추가
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    utter.rate = 1.05;
    window.speechSynthesis.speak(utter);
  } catch (e) {
    // 음성 엔진 오류는 무시 (화면 안내는 계속)
  }
}

const ARRIVAL_RADIUS_METERS = 20;
const OFF_ROUTE_METERS = 50;

// 경로 좌표 중 주어진 위치에서 가장 가까운 점의 인덱스와 거리
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

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  if (mins === 0) return `약 ${Math.max(Math.round(seconds), 10)}초`;
  return `약 ${mins}분`;
}

export default function NavigationHUD({
  navData,
  destination,
  currentPosition,
  onClose,
}) {
  const path = useMemo(
    () => (navData?.coordinates || []).filter((pt) => pt && pt.lat !== undefined && pt.lng !== undefined),
    [navData]
  );

  // 경로 끝에서부터 각 좌표까지 남은 누적 거리
  const remainingFromIdx = useMemo(() => {
    const acc = new Array(path.length).fill(0);
    for (let i = path.length - 2; i >= 0; i--) {
      acc[i] = acc[i + 1] + calculateDistanceMeters(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
    }
    return acc;
  }, [path]);

  // 각 턴바이턴 안내 지점이 경로 좌표의 몇 번째에 해당하는지
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

  const totalDist = navData?.distanceMeters ?? destination?.realDistanceMeters ?? destination?.distanceMeters ?? 0;
  const totalSec = navData?.durationSeconds ?? totalDist / 1.25;
  // 경로상의 평균 보행 속도 (m/s)
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

  // 🔊 음성 안내: 경로가 새로 잡히면(재탐색 포함) 안내 이력 초기화 후 출발 안내
  useEffect(() => {
    announcedRef.current = new Set();
    if (!voiceOn || !navData || !destination) return;
    speak(`${destination.name}까지 ${Math.round(totalDist)}미터, 길안내를 시작합니다.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navData]);

  // 🔊 회전 지점 안내(멀리서 1회, 가까워지면 1회), 경로 이탈, 도착
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
      announce('arrive', `목적지에 도착했습니다. ${destination.buildPlace || ''}`.trim());
      return;
    }
    if (isOffRoute) {
      announce(`offroute-${navData?.distanceMeters}`, '경로를 벗어났습니다.');
      return;
    }
    if (nextStepKey && nextStepPhrase && nextStepDist !== null) {
      if (nextStepDist <= VOICE_NEAR_METERS) {
        announce(`${nextStepKey}-near`, `곧 ${nextStepPhrase}`);
      } else if (nextStepDist <= VOICE_FAR_METERS) {
        announce(`${nextStepKey}-far`, `${Math.round(nextStepDist / 10) * 10}미터 앞에서 ${nextStepPhrase}`);
      }
    }
  }, [voiceOn, destination, hasArrived, isOffRoute, nextStepKey, nextStepPhrase, nextStepDist, navData]);

  // 길안내 종료 시 읽던 음성 중단
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

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
    <div className="v2-nav-hud" role="region" aria-label="실시간 도보 내비게이션">
      <div className="v2-hud-card">
        {/* 상단 남은 거리 및 소요시간 */}
        <div className="v2-hud-top">
          <div className="v2-hud-eta-box">
            {hasArrived ? (
              <span className="v2-hud-eta-val">도착</span>
            ) : (
              <>
                <span className="v2-hud-eta-val">{Math.round(remainingDist)}m</span>
                <span className="v2-hud-eta-time">도보 {formatDuration(remainingDist / speed)}</span>
              </>
            )}
          </div>

          <div className="v2-hud-actions">
            {canSpeak && (
              <button
                type="button"
                className="v2-btn-hud-close"
                onClick={toggleVoice}
                title={voiceOn ? '음성 안내 끄기' : '음성 안내 켜기'}
                aria-label={voiceOn ? '음성 안내 끄기' : '음성 안내 켜기'}
              >
                {voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
            )}
            <a href="tel:119" className="v2-btn-hud-119" title="119 통화">
              <Phone size={15} />
              <span>119</span>
            </a>
            <button
              type="button"
              className="v2-btn-hud-close"
              onClick={onClose}
              title="길안내 종료"
            >
              <X size={18} />
              <span>종료</span>
            </button>
          </div>
        </div>

        {/* 다음 턴바이턴 안내 */}
        {!hasArrived && nextStep && (
          <div className="v2-hud-next-step">
            <span className="v2-hud-step-icon">
              <StepIcon size={22} />
            </span>
            <span className="v2-hud-step-text">
              {nextStepDist !== null && <small>{Math.round(nextStepDist)}m 앞</small>}
              {nextStep.instruction}
            </span>
          </div>
        )}

        {!hasArrived && isOffRoute && (
          <div className="v2-hud-warning">
            <AlertTriangle size={13} /> 경로에서 벗어났어요. 잠시 후 현재 위치에서 경로를 다시 찾습니다.
          </div>
        )}

        {navData && navData.isRealRoad === false && (
          <div className="v2-hud-warning">
            <AlertTriangle size={13} /> 도보 경로를 불러오지 못해 직선 방향으로 안내합니다.
          </div>
        )}

        {/* 목적지 및 상세 위치 안내 */}
        <div className="v2-hud-dest">
          <div className="v2-hud-dest-title">
            <Navigation size={15} className="v2-hud-dest-icon" />
            <span className="v2-hud-name">{destination.name}</span>
          </div>
          <div className="v2-hud-indoor-text">
            <Building size={13} />
            <span>{destination.buildPlace || destination.buildAddress || '상세 설치 위치로 이동하세요.'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
