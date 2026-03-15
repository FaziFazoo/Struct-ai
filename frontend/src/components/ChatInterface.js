import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   VoiceAssistant — replaces ChatInterface.js
   Siri / Google Assistant style voice panel:
   · Central mic button (click = start/stop listening)
   · Waveform animation when LISTENING
   · Real-time transcript
   · Status badge: IDLE | LISTENING | PROCESSING | SPEAKING
   · Compact text fallback + file upload
───────────────────────────────────────────────────────────────────────────── */

const STATUS_CONFIG = {
  IDLE:       { label: 'IDLE',       color: '#00d2ff', pulse: false },
  LISTENING:  { label: 'LISTENING',  color: '#ff4444', pulse: true  },
  PROCESSING: { label: 'PROCESSING', color: '#fbbf24', pulse: true  },
  SPEAKING:   { label: 'SPEAKING',   color: '#34d399', pulse: true  },
};

// Animated waveform bars
const Waveform = ({ active }) => (
  <div className={`waveform ${active ? 'waveform--active' : ''}`} aria-hidden="true">
    {[1, 2, 3, 4, 5, 6, 7].map(i => (
      <div
        key={i}
        className="waveform__bar"
        style={{ animationDelay: `${(i - 1) * 0.07}s` }}
      />
    ))}
  </div>
);

// Mic icon SVG (inline, no extra deps)
const MicIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="8"  y1="22" x2="16" y2="22" />
  </svg>
);

const StopIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const VoiceAssistant = ({
  messages,
  input,
  setInput,
  handleSend,
  speechStatus,
  liveTranscript,
  handleMicInteraction,
  handleFileUpload,
  isAnalyzing,
}) => {
  const scrollRef = useRef(null);
  const cfg = STATUS_CONFIG[speechStatus] || STATUS_CONFIG.IDLE;
  const isActive = speechStatus === 'LISTENING';
  const isBusy   = speechStatus === 'PROCESSING' || speechStatus === 'SPEAKING';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, liveTranscript]);

  return (
    <div className="voice-panel">

      {/* ── Header */}
      <div className="voice-panel__header">
        <div className="header__brand">
          <div className="brand__dot" />
          <div>
            <div className="brand__title">S.T.R.U.C.T</div>
            <div className="brand__sub">AI Structural Engineering Copilot</div>
          </div>
        </div>
        <div className="header__bars" aria-hidden="true">
          {[1, 2, 3].map(i => <div key={i} className="bar" />)}
        </div>
      </div>

      {/* ── Message Log */}
      <div className="voice-panel__messages" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`msg msg--${m.role}`}
            >
              {m.role === 'user' ? (
                <div className="msg__user">
                  <span className="msg__prompt">&gt; YOU</span>
                  <span className="msg__text">{m.content}</span>
                </div>
              ) : (
                <div className="msg__assistant">
                  <div className="msg__orb" />
                  <div className="msg__body">
                    <span className="msg__text">{m.content}</span>
                    {m.type === 'simulation_meta' && (
                      <div className="msg__exec-tag">
                        EXEC:{m.simulation_id?.slice(0, 8).toUpperCase()} · PORTAL ACTIVE
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Live transcript */}
        <AnimatePresence>
          {liveTranscript && (
            <motion.div
              key="transcript"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="live-transcript"
            >
              {liveTranscript}
              <span className="transcript__cursor" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Central Voice Zone */}
      <div className="voice-zone">

        {/* Status badge */}
        <div className="status-badge" style={{ color: cfg.color }}>
          <div
            className={`status-badge__dot ${cfg.pulse ? 'status-badge__dot--pulse' : ''}`}
            style={{ background: cfg.color }}
          />
          {cfg.label}
        </div>

        {/* Waveform — shows when LISTENING */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Waveform active={isActive} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Central Mic Button */}
        <button
          onClick={handleMicInteraction}
          className={`mic-btn mic-btn--${speechStatus.toLowerCase()}`}
          disabled={false}
          aria-label={isActive ? 'Stop listening' : 'Start listening'}
          title={isActive ? 'Tap to stop' : isBusy ? speechStatus : 'Tap to speak'}
        >
          {/* Outer rings */}
          {isActive && (
            <>
              <div className="mic-ring mic-ring--1" />
              <div className="mic-ring mic-ring--2" />
            </>
          )}
          {(speechStatus === 'SPEAKING') && (
            <div className="mic-ring mic-ring--speak" />
          )}

          {/* Icon */}
          <div className="mic-btn__icon">
            {isActive ? <StopIcon size={26} /> : <MicIcon size={28} />}
          </div>
        </button>

        <p className="voice-hint">
          {isActive     ? 'Listening... tap to stop'       :
           isBusy       ? `${speechStatus.toLowerCase()}...` :
           'Tap to speak'}
        </p>
      </div>

      {/* ── Text Input Fallback */}
      <div className="voice-panel__input">
        <div className="text-input-row">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Or type your command..."
            disabled={isAnalyzing}
            className="text-input"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isAnalyzing}
            className="send-btn"
            aria-label="Send"
          >
            ↵
          </button>
        </div>

        {/* Bottom meta row */}
        <div className="input-meta">
          <label className="upload-btn" title="Upload engineering diagram">
            <Upload size={16} />
            <span>Upload Diagram</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
          <div className="version-tag">S.T.R.U.C.T v6</div>
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;
