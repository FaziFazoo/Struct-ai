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
    isListening,
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
    if (isListening) stopListening();
    else startListening();
  };

  return (
    <div className="w-[420px] flex flex-col border-r border-white/10 glass-panel m-2 overflow-hidden shadow-2xl relative">
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
          <span className={`text-[8px] uppercase tracking-widest ${isListening ? 'text-red-400 animate-pulse' : 'text-white/20'}`}>
            {isListening ? '● live' : '○ idle'}
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
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`
                max-w-[90%] p-4 rounded-lg
                ${m.role === 'user'
                  ? 'bg-jarvis-blue/10 border border-jarvis-blue/30 text-jarvis-blue font-light'
                  : 'bg-white/[0.03] border border-white/10 text-white/80 font-extralight tracking-wide'}
                shadow-lg backdrop-blur-sm
              `}>
                <p className="text-[13px] leading-relaxed">{m.content}</p>
                {m.type === 'simulation_meta' && (
                  <div className="mt-2 pt-2 border-t border-white/5 flex gap-4 text-[9px] font-bold uppercase tracking-widest text-white/30">
                    <span>Solver: S.T.R.U.C.T_Engine</span>
                    {m.simulation_id && <span>ID: {m.simulation_id.slice(0, 8)}</span>}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input Module */}
      <div className="p-5 space-y-4 border-t border-white/5 bg-white/[0.01]">
        <div className="flex gap-3 items-center bg-white/5 rounded-xl px-4 py-1 border border-white/5 focus-within:border-jarvis-blue/40 transition-all duration-500">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !speechMode && handleSend()}
            placeholder={speechMode ? "Speech mode active — press mic to speak..." : "Command S.T.R.U.C.T..."}
            disabled={speechMode}
            className="flex-1 bg-transparent py-3 text-[13px] font-light tracking-wide text-white focus:outline-none placeholder:text-white/20 disabled:opacity-50"
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
              className={`transition-all duration-300 relative ${
                isListening
                  ? 'text-red-500 scale-110'
                  : speechMode
                    ? 'text-jarvis-blue hover:scale-110'
                    : 'text-white/20 cursor-not-allowed'
              }`}
              title={speechMode ? (isListening ? 'Stop' : 'Speak') : 'Enable Speech Mode first'}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              {isListening && (
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2">
                  <div className="w-12 h-1 bg-red-500 rounded-full animate-pulse"></div>
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
