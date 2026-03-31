import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Send, Settings, X, Cpu, Globe } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ApiKeyModal from './components/ApiKeyModal';

const SiriPulse = ({ isActive }) => (
  <div className="relative flex items-center justify-center w-full h-48">
    <motion.div
      animate={{
        scale: isActive ? [1, 1.2, 1] : 1,
        opacity: isActive ? [0.3, 0.6, 0.3] : 0.2,
      }}
      transition={{ repeat: Infinity, duration: 2 }}
      className="absolute w-40 h-40 bg-blue-500 rounded-full blur-3xl opacity-20"
    />
    <motion.div
      animate={{
        scale: isActive ? [1, 1.1, 1] : 1,
        opacity: isActive ? [0.2, 0.4, 0.2] : 0.1,
      }}
      transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
      className="absolute w-32 h-32 bg-purple-500 rounded-full blur-3xl opacity-20"
    />
    <div className="z-10 text-white font-light tracking-[0.2em] text-sm animate-pulse-slow">
       S.T.R.U.C.T
    </div>
  </div>
);

function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key'));
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('local'); // 'local' or 'proxy'
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSaveApiKey = (key) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
  };

  const handleSendMessage = async (text) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    const newMessage = { role: 'user', content: messageText };
    setMessages((prev) => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let responseText = '';
      
      if (mode === 'local' && apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
          model: "gemini-1.5-flash",
          systemInstruction: "You are an AI engineering assistant specialized in structural analysis, FEA, and meshing tools like Gmsh. Be concise and technical but clear."
        });
        const result = await model.generateContent(messageText);
        const response = await result.response;
        responseText = response.text();
      } else {
        // Fallback to proxy mode
        const res = await fetch('http://localhost:3001/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText, apiKey })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        responseText = data.text;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: responseText }]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: 'assistant', content: "Error: " + error.message }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleSendMessage(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  if (!apiKey) {
    return <ApiKeyModal onSave={handleSaveApiKey} />;
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#050505] text-zinc-100 font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center p-6 bg-gradient-to-b from-black/50 to-transparent absolute top-0 w-full z-10">
        <div className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-black rotate-3 group-hover:rotate-0 transition-transform cursor-default">
            S
          </div>
          <span className="text-sm font-medium tracking-wide opacity-50 italic">STRUCT copilot</span>
        </div>
        
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setMode(mode === 'local' ? 'proxy' : 'local')}
             className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] hover:bg-white/10 transition-colors"
           >
             {mode === 'local' ? <Globe className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
             {mode.toUpperCase()} MODE
           </button>
           <button onClick={() => { localStorage.removeItem('gemini_api_key'); setApiKey(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors opacity-50">
             <Settings className="w-4 h-4" />
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-6 overflow-y-auto pt-24 pb-32 no-scrollbar">
        {messages.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white mb-2">
              How can I assist your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-medium">engineering</span> today?
            </h1>
            <p className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">
              Structural analysis, finite element modeling, or Gmsh scripting. I’m here to help you build safer and faster.
            </p>
          </motion.div>
        ) : (
          <div className="w-full space-y-12">
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[85%] px-4 py-2 ${m.role === 'user' ? 'text-zinc-400 italic text-right' : 'text-zinc-100 text-lg md:text-xl font-light leading-relaxed'}`}>
                  {m.content}
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <div className="w-full h-8 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </main>

      {/* Footer / Input Area */}
      <div className="absolute bottom-8 left-0 w-full flex flex-col items-center gap-6 px-6 pointer-events-none">
        <SiriPulse isActive={isListening || isLoading} />
        
        <div className="w-full max-w-2xl bg-[#111]/80 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-2 flex items-center gap-2 shadow-2xl pointer-events-auto ring-1 ring-white/10">
          <button 
            onClick={startListening}
            className={`p-3 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-transparent text-zinc-500 hover:text-white hover:bg-white/5'}`}
          >
            <Mic className="w-5 h-5" />
          </button>
          
          <input
            type="text"
            placeholder="Type your command..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-200 placeholder:text-zinc-600 px-2"
          />
          
          <button 
            onClick={() => handleSendMessage()}
            disabled={!input.trim()}
            className="p-3 bg-white text-black rounded-full hover:bg-zinc-200 transition-colors disabled:opacity-20 disabled:cursor-not-allowed shadow-lg"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
