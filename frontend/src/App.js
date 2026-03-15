import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import VoiceAssistant from './components/ChatInterface';
import AnalysisDashboard from './components/AnalysisDashboard';

const API_BASE_URL = 'https://struct-ai-backend-jwpcarpvka-uc.a.run.app';
console.log('[S.T.R.U.C.T] API_BASE_URL:', API_BASE_URL);
console.log('[S.T.R.U.C.T] Window Origin:', window.location.origin);

// Stable session ID for this browser tab
const SESSION_ID = `struct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const App = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'S.T.R.U.C.T initialized. Standing by for your command.' }
  ]);
  const [input, setInput] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState('IDLE');

  // Voice pipeline state
  const [speechStatus, setSpeechStatus] = useState('IDLE'); // IDLE | LISTENING | PROCESSING | SPEAKING
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef(null);
  const handleSendRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  // ── TTS ──────────────────────────────────────────────────────────────────
  const speakResponse = useCallback((text) => {
    synthRef.current.cancel();
    const cleanText = text.replace(/\[.*?\]/g, '').replace(/\*+/g, '').trim();
    if (!cleanText) return;

    const utt = new SpeechSynthesisUtterance(cleanText);
    utt.rate = 1.0;
    utt.pitch = 1.0;
    utt.volume = 1.0;

    utt.onstart = () => setSpeechStatus('SPEAKING');
    utt.onend = () => setSpeechStatus('IDLE');
    utt.onerror = () => setSpeechStatus('IDLE');

    synthRef.current.speak(utt);
  }, []);

  // ── Speech Recognition ───────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Speech recognition not supported. Please use Chrome or Edge.');
      return;
    }

    // Prime TTS engine on first user gesture
    const primer = new SpeechSynthesisUtterance('');
    primer.volume = 0;
    synthRef.current.speak(primer);

    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setSpeechStatus('LISTENING');
      setLiveTranscript('');
    };

    recognition.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setLiveTranscript(final || interim);
      if (final) {
        setSpeechStatus('PROCESSING');
        setTimeout(() => setLiveTranscript(''), 600);
        if (handleSendRef.current) handleSendRef.current(final);
      }
    };

    recognition.onend = () => {
      setSpeechStatus(prev => prev === 'LISTENING' ? 'IDLE' : prev);
    };

    recognition.onerror = (e) => {
      console.error('[STRUCT] Speech error:', e.error);
      if (e.error === 'not-allowed') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Microphone access denied. Please allow microphone access to use voice mode.'
        }]);
      }
      setSpeechStatus('IDLE');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setSpeechStatus('IDLE');
    setLiveTranscript('');
  }, []);

  const handleMicInteraction = useCallback(() => {
    synthRef.current.cancel();
    if (speechStatus === 'LISTENING') {
      stopListening();
    } else if (speechStatus === 'SPEAKING') {
      setSpeechStatus('IDLE');
    } else {
      startListening();
    }
  }, [speechStatus, startListening, stopListening]);

  // ── Main send handler ─────────────────────────────────────────────────────
  const handleSend = async (text = input) => {
    if (!text.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsAnalyzing(true);
    setAnalyzeStatus('RUNNING');
    setSpeechStatus('PROCESSING');

    try {
      // Step 1: Chat — reply + parameter extraction
      const chatResponse = await axios.post(
        `${API_BASE_URL}/chat?query=${encodeURIComponent(text)}`
      );
      const jarvisReply = chatResponse.data.response;
      const normalizedParams = chatResponse.data.parameters;

      setMessages(prev => [...prev, { role: 'assistant', content: jarvisReply }]);
      speakResponse(jarvisReply);

      // Step 2: If parameters extracted → run simulation
      if (normalizedParams) {
        const beamParams = {
          length:         normalizedParams.length,
          load_magnitude: normalizedParams.load,
          load_position:  normalizedParams.load_position,
          support_type:   normalizedParams.beam_type,
          material:       normalizedParams.material,
          beam_width:     normalizedParams.width,
          beam_height:    normalizedParams.height,
          session_id:     SESSION_ID,
        };

        try {
          const simResponse = await axios.post(`${API_BASE_URL}/beam_analysis`, beamParams);
          const simData = simResponse.data;

          setAnalysisData(simData);
          setAnalyzeStatus('COMPLETE');

          // Step 3: Copilot synthesis
          try {
            const synthPrompt = `[SYSTEM_INJECT] Simulation finished: Max Stress ${simData.max_stress_mpa?.toFixed(1)} MPa, FoS ${simData.safety_factor?.toFixed(2)}, Deflection ${simData.deflection_mm?.toFixed(2)} mm. Explain this result as a proactive structural engineering copilot in 3 concise sentences. Mention if it safe (FoS > 1) and suggest one follow-up analysis.`;
            const synthResponse = await axios.post(`${API_BASE_URL}/chat?query=${encodeURIComponent(synthPrompt)}`);
            const synthesis = synthResponse.data.response;
            setMessages(prev => [...prev, {
              role: 'assistant',
              type: 'simulation_meta',
              content: synthesis,
              simulation_id: simData.simulation_id,
            }]);
            speakResponse(synthesis);
          } catch {
            const fallback = `Analysis complete. Maximum stress is ${simData.max_stress_mpa?.toFixed(1)} MPa with a safety factor of ${simData.safety_factor?.toFixed(2)}.`;
            setMessages(prev => [...prev, { role: 'assistant', type: 'simulation_meta', content: fallback, simulation_id: simData.simulation_id }]);
            speakResponse(fallback);
          }

        } catch (simErr) {
          const detail = simErr.response?.data?.detail || simErr.message;
          setAnalyzeStatus('ERROR');
          setMessages(prev => [...prev, { role: 'assistant', content: `Simulation failed: ${detail}` }]);
        }
      } else {
        setAnalyzeStatus('IDLE');
      }

    } catch (chatErr) {
      const detail = chatErr.response?.data?.detail || chatErr.message;
      setAnalyzeStatus('ERROR');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Connection failed: ${detail}. Verify the backend is running at ${API_BASE_URL}.`
      }]);
    } finally {
      setIsAnalyzing(false);
      setSpeechStatus(prev => prev === 'PROCESSING' ? 'IDLE' : prev);
    }
  };

  // ── Diagram upload handler ────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsAnalyzing(true);
    setAnalyzeStatus('RUNNING');
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'Diagram received. Extracting structural parameters from image...'
    }]);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/diagram_analysis`, {
          image: reader.result,
          prompt: 'Extract beam length, load, boundary conditions, and dimensions from this engineering diagram'
        });

        if (response.data.status === 'clarify') {
          setAnalyzeStatus('IDLE');
          const msg = response.data.message;
          setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
          speakResponse(msg);
          return;
        }

        setAnalysisData(response.data);
        setAnalyzeStatus('COMPLETE');
        const extractedType = response.data.parameters?.beam_type ?? 'beam';

        try {
          const synthPrompt = `[SYSTEM_INJECT] Vision analysis complete. Formally acknowledge the extraction of a ${extractedType} beam from the uploaded diagram and confirm the simulation results have been computed.`;
          const synthResponse = await axios.post(`${API_BASE_URL}/chat?query=${encodeURIComponent(synthPrompt)}`);
          const msg = synthResponse.data.response;
          setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
          speakResponse(msg);
        } catch {
          const msg = `Diagram analyzed. Extracted ${extractedType} beam profile. Simulation results computed.`;
          setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
          speakResponse(msg);
        }
      } catch (err) {
        const detail = err.response?.data?.detail || err.message;
        setAnalyzeStatus('ERROR');
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Diagram analysis failed: ${detail}`
        }]);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="app-shell">
      {/* Ambient grid background */}
      <div className="bg-grid" aria-hidden="true" />

      <div className="main-layout">
        <VoiceAssistant
          messages={messages}
          input={input}
          setInput={setInput}
          handleSend={handleSend}
          speechStatus={speechStatus}
          liveTranscript={liveTranscript}
          handleMicInteraction={handleMicInteraction}
          handleFileUpload={handleFileUpload}
          isAnalyzing={isAnalyzing}
        />

        <AnalysisDashboard
          analysisData={analysisData}
          isAnalyzing={isAnalyzing}
          analyzeStatus={analyzeStatus}
        />
      </div>
    </div>
  );
};

export default App;
