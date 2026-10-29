import React, { useState, useEffect, useRef } from 'react';
import { X, Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { CallButton } from './EmergencyBottomCard';

const BPM = 105;
const BEAT_SEC = 60 / BPM;
const COMPRESSIONS_PER_CYCLE = 30;
const SCHEDULE_AHEAD_SEC = 0.12; // 이만큼 앞의 박자까지 미리 예약
const SCHEDULER_TICK_MS = 25;
const BREATH_CUE_MS = 4000;

/**
 * CPR 박자 안내 (전체 화면)
 * - 분당 100~120회 권고 범위의 105회 박자를 화면·소리·진동으로 안내
 * - 오디오 시계에 박자를 미리 예약해 화면이 바빠도 박자가 밀리지 않음
 * - 압박 중 실수로 닫히지 않도록 바깥을 눌러도 닫히지 않고, 닫기 버튼으로만 닫힌다
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
    if (!isOpen || !isPlaying) return undefined;

    const timers = new Set();
    const later = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, Math.max(0, ms));
      timers.add(id);
    };

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

  useEffect(() => {
    if (!isOpen) {
      setBeatCount(0);
      setShowBreathCue(false);
      setIsPlaying(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="sm-cpr" role="dialog" aria-modal="true" aria-labelledby="sm-cpr-title">
      <div className="sm-cpr-head">
        <h2 id="sm-cpr-title" className="sm-headline" style={{ fontSize: 22 }}>박자에 맞춰 가슴을 눌러요</h2>
        <button type="button" className="sm-cpr-close" onClick={onClose}>
          <X size={18} aria-hidden="true" /> 닫기
        </button>
      </div>
      <p className="sm-headline-sub">
        가슴 한가운데를 5cm 깊이로, 세게 빨리 눌러요. AED가 올 때까지 멈추지 마세요.
      </p>

      <div className="sm-cpr-beat-zone">
        <div className={`sm-cpr-beat ${pulseActive ? 'on' : ''}`} aria-hidden="true">
          <span className="sm-cpr-count">{beatCount}</span>
          <span className="sm-cpr-count-sub">/ 30번</span>
        </div>
        <div className="sm-cpr-cue" role="status" aria-live="polite">
          {showBreathCue ? (
            <>
              <strong>30번 했어요. 인공호흡 2번</strong>
              배운 적이 없다면 인공호흡 없이 계속 눌러도 돼요.
            </>
          ) : (
            isPlaying ? '1분에 105번 박자예요' : '박자를 멈췄어요'
          )}
        </div>
      </div>

      <div className="sm-cpr-ctrls">
        <button type="button" className="sm-btn-sec" onClick={() => setIsPlaying((p) => !p)}>
          {isPlaying ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
          {isPlaying ? '박자 멈추기' : '박자 다시 시작'}
        </button>
        <button type="button" className="sm-btn-sec" onClick={() => setIsMuted((m) => !m)} aria-pressed={isMuted}>
          {isMuted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
          {isMuted ? '소리 켜기' : '소리 끄기'}
        </button>
      </div>
      <div className="sm-actions" style={{ gridTemplateColumns: '1fr' }}>
        <CallButton />
      </div>
      <p className="sm-cpr-legal">
        119에 전화를 스피커로 켜 두면 상황실의 안내를 함께 들을 수 있어요.
        선의로 한 응급처치는 응급의료법 제5조의2에 따라 책임이 감면돼요.
      </p>
    </div>
  );
}
