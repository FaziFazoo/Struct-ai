import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Activity, Send, Upload } from 'lucide-react';
import axios from 'axios';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiLiveClient } from '../utils/GeminiLiveClient';

const LiveVoiceAssistant = ({ 
  apiKey, 
  modelId,
  backendBaseUrl,
  universalConfig,
  onAnalysisRequested, 
  messages, 
  setMessages,
  analyzeStatus,
  handleFileUpload
}) => {
  const [isLive, setIsLive] = useState(false);
  const [speechStatus, setSpeechStatus] = useState('IDLE'); // IDLE | LISTENING | SPEAKING
  const [textInput, setTextInput] = useState('');
  
  const clientRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const scrollRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const isLiveAudioPlayingRef = useRef(false);
  const recognitionRef = useRef(null);

  const speakText = (text) => {
    console.log("[S.T.R.U.C.T] Attempting Browser TTS:", text);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onstart = () => { console.log("[S.T.R.U.C.T] TTS Started speaking"); };
      utterance.onend = () => { 
        console.log("[S.T.R.U.C.T] TTS Ended");
        isLiveAudioPlayingRef.current = false; 
      };
      utterance.onerror = (e) => { console.error("[S.T.R.U.C.T] TTS Error:", e); };
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn("[S.T.R.U.C.T] SpeechSynthesis not supported in this browser.");
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Audio Context Resumption on user interaction
  useEffect(() => {
    const resumeAudio = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        console.log("[S.T.R.U.C.T] Resuming AudioContext via background listener");
        audioContextRef.current.resume();
      }
    };
    window.addEventListener('click', resumeAudio);
    return () => window.removeEventListener('click', resumeAudio);
  }, []);

  const handleLiveMessage = useCallback((data) => {
    console.log("[GeminiLive] Msg:", data);
    
    // 1. Handle User Transcription
    if (data.server_content?.input_transcription) {
      const trans = data.server_content.input_transcription.transcription;
      if (trans) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.id === 'live-transcription') {
            return [...prev.slice(0, -1), { role: 'user', content: `[Listening...] ${trans}`, live: true, id: 'live-transcription' }];
          }
          return [...prev, { role: 'user', content: `[Listening...] ${trans}`, live: true, id: 'live-transcription' }];
        });
      }
    }

    // 2. Handle Tool Calls
    if (data.server_content?.model_turn?.parts?.[0]?.function_call) {
      const call = data.server_content.model_turn.parts[0].function_call;
      if (call.name === 'analyze_beam') {
        onAnalysisRequested(call.args);
      }
    }

    // 3. Handle Text Responses (Model Transcript)
    const part = data.server_content?.model_turn?.parts?.[0];
    if (part?.text) {
      console.log("[GeminiLive] Text Part:", part.text);
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== 'live-transcription');
        return [...filtered, { role: 'assistant', content: part.text }];
      });
      // Safety: always attempt TTS if audio isn't already streaming
      if (!isLiveAudioPlayingRef.current) {
        speakText(part.text);
      }
    }
    
    // 4. Handle Audio
    if (data.server_content?.model_turn?.parts?.[0]?.inline_data?.data) {
      isLiveAudioPlayingRef.current = true;
      scheduleAudio(data.server_content.model_turn.parts[0].inline_data.data);
    }
  }, [onAnalysisRequested, setMessages]);

  const scheduleAudio = (base64Data) => {
    if (!audioContextRef.current) return;
    const audioContext = audioContextRef.current;
    
    // Decode base64 to ArrayBuffer
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Convert back to Int16 PCM
    const pcm16 = new Int16Array(bytes.buffer);
    
    // Convert to Float32 for Web Audio API
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }
    
    // Create AudioBuffer (assuming 24000 Hz for Gemini Live Output)
    const buffer = audioContext.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    
    // Schedule for gapless playback
    const currentTime = audioContext.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime + 0.05; // Small buffer
    }
    
    source.start(nextStartTimeRef.current);
    console.log("[S.T.R.U.C.T] Scheduled audio chunk at", nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
    setSpeechStatus('SPEAKING');
    
    source.onended = () => {
      isLiveAudioPlayingRef.current = false;
      if (audioContext.currentTime >= nextStartTimeRef.current - 0.1) {
         setSpeechStatus('LISTENING');
         console.log("[S.T.R.U.C.T] Assistant finished speaking chunk");
      }
    };
  };

  const startBrowserVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window)) {
      console.warn("Speech recognition not supported");
      return;
    }
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setSpeechStatus('LISTENING');
      setIsLive(true);
      setMessages(prev => [...prev, { role: 'assistant', content: "🎤 Switched to Browser Voice Mode. I can hear you now!" }]);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setTextInput(finalTranscript);
        // We'll let the user hit send or we could auto-trigger
        // setTextInput(prev => prev + ' ' + finalTranscript);
      }
    };

    recognition.onerror = (e) => {
      console.error("Recognition error", e);
      setIsLive(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [setMessages, setTextInput]);

  const handleError = useCallback((err) => {
    console.error("[S.T.R.U.C.T] Live Error:", err);
    setIsLive(false);
    setSpeechStatus('ERROR');
    
    let detail = "Connection failed. Please check your API Key and ensure you have access to the Gemini Multimodal Live API.";
    if (err.type === 'error') {
      detail = "WebSocket Error: The connection was refused. This usually means the API Key is invalid, restricted, or at quota.";
    }
    
    setMessages(prev => [...prev, { role: 'assistant', content: detail }]);
    startBrowserVoice();
  }, [setMessages, startBrowserVoice]);

  const toggleLive = async () => {
    if (isLive) {
      clientRef.current?.disconnect();
      processorRef.current?.disconnect();
      recognitionRef.current?.stop();
      setIsLive(false);
      setSpeechStatus('IDLE');
    } else {
      if (!apiKey) {
        alert("Please set a Gemini API Key in the settings.");
        return;
      }
      
      if (apiKey.length < 30) {
        setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ ALERT: Your Gemini API Key looks too short. This usually causes immediate connection failure. Please verify it in Settings." }]);
      }

      // FOR THE LIVE WEBSOCKET: Always use a model known to support multimodal live in v1alpha
      const liveModel = modelId?.includes('2.0') ? modelId : 'gemini-2.0-flash-exp';
      const client = new GeminiLiveClient(apiKey, liveModel);
      client.onMessage = handleLiveMessage;
      client.onError = handleError;
      const connectionStartTime = Date.now();
      client.onClose = () => {
        setIsLive(false);
        setSpeechStatus('IDLE');
        if (processorRef.current) processorRef.current.disconnect();
        
        const duration = Date.now() - connectionStartTime;
        if (duration < 2000) {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: "⚠️ Connection Rejected: Scaling to Robust Fallback Mode (Web Speech)..." 
          }]);
          startBrowserVoice();
        }
      };
      await client.connect();
      clientRef.current = client;

      // Start Microphone
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext({ sampleRate: 16000 }); // Record at 16k for Gemini
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        nextStartTimeRef.current = audioContext.currentTime;
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
          }
          let binary = '';
          const bytes = new Uint8Array(pcm16.buffer);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          client.sendAudioChunk(base64);
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        
        audioContextRef.current = audioContext;
        processorRef.current = processor;
        setIsLive(true);
        setSpeechStatus('LISTENING');
        setMessages(prev => [...prev, { role: 'assistant', content: "🎙️ S.T.R.U.C.T Live is active. I can hear you now. How can I help with your project?" }]);
      } catch (err) {
        console.error("Mic error:", err);
        setMessages(prev => [...prev, { role: 'assistant', content: `Microphone Error: ${err.message}. Please check browser permissions.` }]);
      }
    }
  };

  const handleUniversalFallback = async (input) => {
    if (!universalConfig?.key) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Primary connection failed and no demo safety net (Universal API Key) is configured." }]);
      return;
    }

    setMessages(prev => [...prev, { role: 'assistant', content: `Engaging Universal Safety Net (${universalConfig.model})...` }]);
    
    try {
      // CALL BACKEND PROXY TO BYPASS CORS
      const proxyUrl = backendBaseUrl ? `${backendBaseUrl}/universal_proxy` : '/universal_proxy';
      const response = await axios.post(proxyUrl, {
        config: universalConfig,
        query: input
      });

      const choice = response.data.choices?.[0];
      const toolCall = choice?.message?.tool_calls?.[0]?.function;

      if (toolCall) {
        onAnalysisRequested(JSON.parse(toolCall.arguments));
      } else if (choice?.message?.content) {
        setMessages(prev => [...prev.filter(m => !m.content.includes('Engaging Universal')), { role: 'assistant', content: choice.message.content }]);
        speakText(choice.message.content);
      }
    } catch (err) {
      console.error("Universal fallback error:", err);
      const errorMsg = err.response?.data?.detail || "Demo Safety Net also failed. Check console for error details.";
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
    }
  };
  const handleSendText = async () => {
    const currentInput = textInput.trim();
    if (!currentInput) return;
    setMessages(prev => [...prev, { role: 'user', content: currentInput }]);
    setTextInput('');

    // If we're using browser voice, stop it momentarily to avoid feedback
    if (recognitionRef.current) {
      console.log("[S.T.R.U.C.T] Stopping recognition for turnover");
      recognitionRef.current.stop();
    }

    const isWsOpen = clientRef.current?.ws?.readyState === WebSocket.OPEN;
    if (isLive && isWsOpen) {
      console.log("[S.T.R.U.C.T] Sending via Live WebSocket");
      clientRef.current.sendText(currentInput);
    } else {
      console.log("[S.T.R.U.C.T] Sending via HTTP Fallback channel");
      // HTTP FALLBACK (Gemini SDK)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connecting via fallback channel...' }]);
      setSpeechStatus('THINKING');
      
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // REORDERED FOR MAXIMUM SUCCESS (2.5 -> Latest -> 1.5 -> Exp)
        const modelsToTry = [modelId, 'gemini-2.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'];
        let lastErr = null;
        let successResult = null;

        for (const mName of modelsToTry) {
          try {
            console.log(`[S.T.R.U.C.T] Attempting fallback with ${mName}...`);
            const genModel = genAI.getGenerativeModel({ 
              model: mName,
              tools: [{
                functionDeclarations: [{
                  name: "analyze_beam",
                  description: "Run a structural analysis on a beam.",
                  parameters: {
                    type: "object",
                    properties: {
                      length: { type: "number" },
                      load: { type: "number" },
                      load_position: { type: "number" },
                      type: { type: "string", enum: ["cantilever", "simply_supported"] },
                      material: { type: "string" },
                      width: { type: "number" },
                      height: { type: "number" }
                    },
                    required: ["length", "load", "type"]
                  }
                }]
              }]
            });

            const result = await genModel.generateContent(currentInput);
            successResult = await result.response;
            console.log(`[S.T.R.U.C.T] Success with ${mName}`);
            break; 
          } catch (e) {
            console.warn(`[S.T.R.U.C.T] ${mName} failed:`, e.message);
            lastErr = e;
          }
        }

        if (successResult) {
          const part = successResult.candidates?.[0]?.content?.parts?.[0];
          if (part?.functionCall) {
            onAnalysisRequested(part.functionCall.args);
          } else if (part?.text) {
            setMessages(prev => [...prev.filter(m => m.content !== 'Connecting via fallback channel...'), { role: 'assistant', content: part.text }]);
            speakText(part.text);
          }
        } else {
           throw lastErr;
        }

      } catch (err) {
        console.error("Gemini paths failed, engaging Universal Safety Net...");
        await handleUniversalFallback(currentInput);
      } finally {
        setSpeechStatus('IDLE');
      }
    }
  };

  return (
    <div className="voice-panel">
      <div className="voice-panel__header">
        <div className="header__brand">
          <div className={`brand__dot ${isLive ? 'active' : ''}`} style={{ background: isLive ? '#34d399' : '#00d2ff' }} />
          <div>
            <div className="brand__title">S.T.R.U.C.T LIVE</div>
            <div className="brand__sub">Multimodal Engineering Agent</div>
          </div>
        </div>
        <div className="status-badge" style={{ color: isLive ? '#34d399' : '#00d2ff' }}>
          {isLive ? 'LIVE CONNECTED' : 'STANDBY'}
        </div>
      </div>

      <div className="voice-panel__messages" ref={scrollRef}>
        <AnimatePresence>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
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
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="voice-zone">
        <div className="waveform-container">
          {isLive && <div className="live-orb" />}
          <span className="voice-hint">{isLive ? "Gemini is listening..." : "Tap to activate Live Agent"}</span>
        </div>

        <button 
          onClick={toggleLive}
          className={`mic-btn ${isLive ? 'mic-btn--listening' : ''}`}
        >
          {isLive ? <MicOff size={32} /> : <Mic size={32} />}
        </button>
      </div>

      <div className="voice-panel__input">
        <div className="text-input-row">
          <label className="upload-btn">
            <Upload size={18} />
            <input type="file" onChange={handleFileUpload} hidden accept="image/*" />
          </label>
          <input 
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendText()}
            placeholder="Type a query..."
            className="text-input"
          />
          <button onClick={handleSendText} className="send-btn"><Send size={18} /></button>
        </div>
      </div>
    </div>
  );
};

export default LiveVoiceAssistant;
