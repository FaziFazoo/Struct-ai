import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Upload, MessageSquare } from 'lucide-react';

const ChatInterface = ({
    messages,
    input,
    setInput,
    handleSend,
    speechMode,
    toggleSpeechMode,
    speechStatus,
    liveTranscript,
    startListening,
    stopListening,
    handleFileUpload
}) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleMicClick = () => {
    if (!speechMode) return;
    if (speechStatus === 'LISTENING' || speechStatus === 'PROCESSING') stopListening();
    else startListening();
  };

  return (
    <div className="w-full md:w-[420px] h-[50vh] md:h-full flex flex-col border-b md:border-b-0 md:border-r border-white/10 glass-panel md:m-2 overflow-hidden shadow-2xl relative flex-shrink-0">
      {/* HUD Header — S.T.R.U.C.T Branding */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-2 h-2 bg-jarvis-blue rounded-full shadow-glow animate-pulse"></div>
            <div className="absolute inset-0 w-2 h-2 bg-jarvis-blue rounded-full animate-ping opacity-75"></div>
          </div>
          <div>
            <h1 className="text-xs font-black tracking-[0.4em] text-white/90 uppercase">
              S.T.R.U.C.T
            </h1>
            <p className="text-[8px] text-white/30 tracking-[0.15em] uppercase font-light">
              AI Structural Engineering Copilot
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map(i => <div key={i} className="w-1 h-3 bg-white/10"></div>)}
        </div>
      </div>

      {/* Mode Toggle Bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-white/[0.01]">
        <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Mode:</span>
        <button
          onClick={toggleSpeechMode}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all duration-300 ${
            speechMode
              ? 'bg-jarvis-blue/20 border border-jarvis-blue/50 text-jarvis-blue'
              : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/60'
          }`}
        >
          {speechMode ? <Mic size={10} /> : <MessageSquare size={10} />}
          {speechMode ? 'Speech' : 'Text'}
        </button>
        {speechMode && (
          <span className={`text-[8px] uppercase tracking-widest ${speechStatus === 'LISTENING' ? 'text-red-400 animate-pulse' : speechStatus === 'PROCESSING' ? 'text-yellow-400 animate-pulse' : 'text-white/20'}`}>
            {speechStatus === 'LISTENING' ? '● listening' : speechStatus === 'PROCESSING' ? '● processing' : '○ idle'}
          </span>
        )}
      </div>

      {/* Message Stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar bg-gradient-to-b from-transparent to-black/20"
      >
        <AnimatePresence>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex flex-col mb-4 font-mono text-[12px] tracking-wide ${m.role === 'user' ? 'text-white/60' : 'text-jarvis-blue'}`}
            >
              {m.role === 'user' ? (
                <div className="flex gap-3">
                  <span className="text-white/30 select-none">{'>'} COMMAND:</span>
                  <span className="text-white/80 uppercase">{m.content}</span>
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="mt-1 w-2 h-2 bg-jarvis-blue rounded-full shadow-glow"></div>
                  <div className="flex-1 space-y-1">
                    <span className="text-jarvis-blue/90">{m.content.replace(/^\[.*?\]\s*/, '')}</span>
                    {m.type === 'simulation_meta' && (
                      <div className="mt-2 pt-2 text-[10px] text-jarvis-blue/40 border-t border-jarvis-blue/10 w-fit uppercase tracking-widest">
                        [EXEC_ID: {m.simulation_id?.slice(0, 8)}] PORTAL_STATUS: ACTIVE
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Live Transcript Overlay */}
      <AnimatePresence>
        {liveTranscript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="px-6 py-2 pb-0 -mb-2 z-10"
          >
            <div className="text-[13px] font-mono italic text-white/50 border-l-2 border-red-500/50 pl-3">
              {liveTranscript}...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Module */}
      <div className="p-5 space-y-4 border-t border-white/5 bg-white/[0.01]">
        <div className="flex gap-3 items-center bg-white/5 rounded-xl px-4 py-1 border border-white/5 focus-within:border-jarvis-blue/40 transition-all duration-500">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !speechMode && handleSend()}
            placeholder={speechMode ? "Tap microphone to speak..." : "Command S.T.R.U.C.T..."}
            disabled={speechMode}
            className="flex-1 bg-transparent py-3 text-[13px] md:text-[13px] font-light tracking-wide text-white focus:outline-none placeholder:text-white/20 disabled:opacity-50 min-w-0"
          />
          {!speechMode && (
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="group p-2 text-white/20 hover:text-jarvis-blue transition-all disabled:opacity-0"
            >
              <Send size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>

        <div className="flex justify-between items-center px-2">
          <div className="flex gap-5 items-center">
            {/* Mic button — active only in speech mode */}
            <button
              onClick={handleMicClick}
              disabled={!speechMode}
              className={`transition-all duration-300 relative p-2 md:p-0 flex items-center justify-center ${
                speechStatus === 'LISTENING'
                  ? 'text-red-500 scale-125 md:scale-110'
                  : speechStatus === 'PROCESSING'
                    ? 'text-yellow-400 animate-pulse scale-125 md:scale-100'
                    : speechMode
                      ? 'text-jarvis-blue hover:scale-110 scale-125 md:scale-100'
                      : 'text-white/20 cursor-not-allowed'
              }`}
              title={speechMode ? (speechStatus !== 'IDLE' ? 'Stop' : 'Speak') : 'Enable Speech Mode first'}
            >
              {speechStatus !== 'IDLE' ? <MicOff className="w-6 h-6 md:w-5 md:h-5" /> : <Mic className="w-6 h-6 md:w-5 md:h-5" />}
              {speechStatus === 'LISTENING' && (
                <div className="absolute -bottom-5 md:-bottom-7 left-1/2 -translate-x-1/2">
                  <div className="w-10 md:w-12 h-1 bg-red-500 rounded-full animate-pulse"></div>
                </div>
              )}
            </button>

            {/* File upload */}
            <label className="text-white/30 hover:text-jarvis-blue cursor-pointer transition-all">
              <Upload size={18} />
              <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
            </label>

            <div className="h-4 w-px bg-white/10"></div>
            <div className="flex items-center gap-2">
              <div className={`w-1 h-1 rounded-full ${speechMode ? 'bg-jarvis-blue animate-pulse' : 'bg-white/20'}`}></div>
              <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">
                {speechMode ? 'Speech_Active' : 'Text_Mode'}
              </span>
            </div>
          </div>
          <div className="text-[8px] text-white/10 font-black uppercase tracking-[0.5em] select-none">S.T.R.U.C.T_v5</div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
