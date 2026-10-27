import React, { useState, useEffect, useRef } from 'react';
import { X, Volume2, VolumeX, ShieldAlert, Heart, Play, Pause } from 'lucide-react';

/**
 * 🫀 105 BPM 심폐소생술(CPR) 메트로놈 & 선한 사마리아인 법적 보호 모달
 * - AHA/ERC 권고 기준 분당 100~120회 (기본 105 BPM) 리듬 시각/청각 피드백
 * - Web Audio API를 활용한 무지연 전자 비프음
 * - 응급의료법 제5조의2 면책 조항 명시로 일반인의 구조 심리 장벽 해소
 */
export default function CprMetronomeModal({ isOpen, onClose }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [beatCount, setBeatCount] = useState(0);
  const [pulseActive, setPulseActive] = useState(false);

  const audioCtxRef = useRef(null);
  const intervalRef = useRef(null);

  // Web Audio 비프음 재생
  const playBeep = () => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtxRef.current.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + 0.08);
    } catch (e) {
      // AudioContext 제한 무시
    }
  };

  useEffect(() => {
    if (!isOpen || !isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // 105 BPM = 60000 / 105 = 571.4ms
    const intervalMs = Math.round(60000 / 105);

    intervalRef.current = setInterval(() => {
      setBeatCount((prev) => (prev % 30) + 1); // 30회 압박 주기 카운트
      setPulseActive(true);
      playBeep();
      setTimeout(() => setPulseActive(false), 140);
    }, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen, isPlaying, isMuted]);

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
