import React, { useState, useEffect, useRef } from 'react';
import { X, Volume2, VolumeX, ShieldAlert, Heart, Play, Pause, Wind } from 'lucide-react';

const BPM = 105;
const BEAT_SEC = 60 / BPM;
const COMPRESSIONS_PER_CYCLE = 30;
const SCHEDULE_AHEAD_SEC = 0.12; // 이만큼 앞의 박자까지 미리 예약
const SCHEDULER_TICK_MS = 25;
const BREATH_CUE_MS = 4000;

/**
 * 🫀 105 BPM 심폐소생술(CPR) 메트로놈 & 선한 사마리아인 법적 보호 모달
 * - AHA/ERC 권고 기준 분당 100~120회 (기본 105 BPM) 리듬 시각/청각/진동 피드백
 * - 오디오 시계(AudioContext.currentTime)에 박자를 미리 예약해, 화면이 바빠도 박자가 밀리지 않음
 * - 30회 압박마다 인공호흡 안내 (교육받지 않은 경우 가슴압박만 계속하도록 안내)
 * - 응급의료법 제5조의2 면책 조항 명시로 일반인의 구조 심리 장벽 해소
 */
export default function CprMetronomeModal({ isOpen, onClose }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [beatCount, setBeatCount] = useState(0);
  const [pulseActive, setPulseActive] = useState(false);
  const [showBreathCue, setShowBreathCue] = useState(false);

  const audioCtxRef = useRef(null);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    const timers = new Set();
    const later = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, Math.max(0, ms));
      timers.add(id);
    };

    // 박자 1회의 화면 깜빡임·카운트·진동
    let count = 0;
    const onBeat = () => {
      count = (count % COMPRESSIONS_PER_CYCLE) + 1;
      setBeatCount(count);
      setPulseActive(true);
      later(() => setPulseActive(false), 140);
      if (navigator.vibrate) navigator.vibrate(40);
      if (count === COMPRESSIONS_PER_CYCLE) {
        setShowBreathCue(true);
        later(() => setShowBreathCue(false), BREATH_CUE_MS);
      }
    };

    let ctx = null;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {
      ctx = null;
    }

    // 오디오 미지원 환경: 일반 타이머로 화면·진동 박자만 제공
    if (!ctx) {
      const id = setInterval(onBeat, BEAT_SEC * 1000);
      return () => {
        clearInterval(id);
        timers.forEach(clearTimeout);
      };
    }

    let nextBeatTime = ctx.currentTime + 0.05;
    const scheduleBeep = (time) => {
      if (isMutedRef.current) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, time);
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.08);
    };

    const scheduler = setInterval(() => {
      while (nextBeatTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
        scheduleBeep(nextBeatTime);
        later(onBeat, (nextBeatTime - ctx.currentTime) * 1000);
        nextBeatTime += BEAT_SEC;
      }
    }, SCHEDULER_TICK_MS);

    return () => {
      clearInterval(scheduler);
      timers.forEach(clearTimeout);
    };
  }, [isOpen, isPlaying]);

  // 모달을 닫으면 카운트·안내 초기화
  useEffect(() => {
    if (!isOpen) {
      setBeatCount(0);
      setShowBreathCue(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="v2-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="v2-cpr-modal" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="v2-cpr-header">
          <div className="v2-cpr-badge">
            <span className="v2-pulse-dot"></span>
            <span>105 BPM CPR 가이드</span>
          </div>
          <button type="button" className="v2-btn-close" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        {/* 메인 펄스 애니메이션 영역 */}
        <div className="v2-cpr-pulse-zone">
          <div className={`v2-cpr-ring ${pulseActive ? 'active' : ''}`}></div>
          <div className={`v2-cpr-circle ${pulseActive ? 'active' : ''}`}>
            <Heart size={44} className="v2-heart-icon" fill="currentColor" />
            <div className="v2-cpr-count">{beatCount}</div>
            <div className="v2-cpr-sub">/ 30회 압박</div>
          </div>
        </div>

        {/* 30회 압박 완료 시 인공호흡 안내 */}
        {showBreathCue && (
          <div className="v2-cpr-breath-cue" role="status">
            <Wind size={18} />
            <div>
              <strong>30회 완료 · 인공호흡 2회</strong>
              <span>교육받지 않았다면 인공호흡 없이 가슴압박만 계속하세요.</span>
            </div>
          </div>
        )}

        {/* 1줄 행동 수칙 */}
        <div className="v2-cpr-instruction">
          <strong>가슴 중앙(젖꼭지 사이 흉골)을 5cm 깊이로 강하고 빠르게 압박하세요.</strong>
          <p>AED가 도착할 때까지 이 박자에 맞춰 압박을 중단하지 마세요.</p>
        </div>

        {/* 컨트롤 버튼 */}
        <div className="v2-cpr-ctrls">
          <button
            type="button"
            className={`v2-ctrl-btn ${isPlaying ? 'pause' : 'play'}`}
            onClick={() => setIsPlaying((p) => !p)}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            <span>{isPlaying ? '박자 일시정지' : '박자 재생 시작'}</span>
          </button>

          <button
            type="button"
            className="v2-ctrl-btn sound"
            onClick={() => setIsMuted((m) => !m)}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            <span>{isMuted ? '소리 켜기' : '소리 끄기'}</span>
          </button>
        </div>

        {/* ⚖️ 선한 사마리아인 법률 보호 배너 (소방청 권고사항) */}
        <div className="v2-legal-banner">
          <div className="v2-legal-title">
            <ShieldAlert size={16} />
            <span>응급의료법 제5조의2 (선의의 응급의료 면책)</span>
          </div>
          <p className="v2-legal-text">
            생명이 위급한 응급환자에게 응급처치를 제공하여 발생한 재산상 손해 및 사상에 대해,
            고의나 중과실이 없는 경우 <strong>민·형사상 법적 책임이 감면 또는 면제</strong>됩니다.
            망설이지 말고 가슴을 압박하세요!
          </p>
        </div>
      </div>
    </div>
  );
}
