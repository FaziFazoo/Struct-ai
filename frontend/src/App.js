import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import ChatInterface from './components/ChatInterface';
import AnalysisDashboard from './components/AnalysisDashboard';

const API_BASE_URL = 'http://localhost:8000';

// Stable session ID for this browser tab
const SESSION_ID = `struct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const App = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "[SYSTEM_INIT] S.T.R.U.C.T Core initialized and standing by for parameter input." }
  ]);
  const [input, setInput] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState('IDLE'); // 'IDLE' | 'RUNNING' | 'COMPLETE' | 'ERROR'

  // Speech mode
  const [speechMode, setSpeechMode] = useState(false);
  const [speechStatus, setSpeechStatus] = useState('IDLE'); // 'IDLE' | 'LISTENING' | 'PROCESSING'
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef(null);
  const handleSendRef = useRef(null);

  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  // ── TTS ────────────────────────────────────────────────────────────────
  const speakResponse = useCallback((text) => {
    if (!speechMode) return;
    window.speechSynthesis.cancel();
    
    // Strip out console prefixes (e.g. [SYSTEM_INIT]) before speaking
    const cleanText = text.replace(/\[.*?\]/g, '').trim();
    if (!cleanText) return;

    const utt = new SpeechSynthesisUtterance(cleanText);
    utt.rate = 1;
    utt.pitch = 1;
    utt.volume = 1;
    window.speechSynthesis.speak(utt);
  }, [speechMode]);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported. Use Chrome.'); return; }
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setLiveTranscript(final || interim);
      if (final) {
        setSpeechStatus('PROCESSING');
        // Small delay to let the user see their final text before clearing
        setTimeout(() => setLiveTranscript(''), 800);
        if (handleSendRef.current) handleSendRef.current(final);
      }
    };
    recognition.onstart = () => {
      setSpeechStatus('LISTENING');
      setLiveTranscript('');
    };
    recognition.onend = () => {
      setSpeechStatus(prev => prev === 'LISTENING' ? 'IDLE' : prev);
    };
    recognition.onerror = (e) => {
      console.log("Speech error:", e.error);
      if (e.error === 'not-allowed') {
        setSpeechMode(false);
        setMessages(prev => [...prev, { role: 'assistant', content: "[SYSTEM_ERROR] Microphone access denied. Reverting to manual input." }]);
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

  const toggleSpeechMode = useCallback(() => {
    setSpeechMode(prev => {
      if (prev) { 
        stopListening(); 
        window.speechSynthesis.cancel(); 
      } else {
        // Prime synthesis engine on toggle (which requires a user click) 
        // to bypass modern browser interaction policies for audio playback.
        const initUtt = new SpeechSynthesisUtterance('');
        initUtt.volume = 0;
        window.speechSynthesis.speak(initUtt);
      }
      return !prev;
    });
  }, [stopListening]);

  // ── Main send handler ──────────────────────────────────────────────────
  const handleSend = async (text = input) => {
    if (!text.trim()) return;

    console.log('[STRUCT] Input received: text');
    console.log('[STRUCT] User query:', text);
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsAnalyzing(true);
    setAnalyzeStatus('RUNNING');

    try {
      // ── Single call: chat reply + parameter extraction + normalization ──
      console.log('[STRUCT] Step 1: Sending to /chat (combined call)');
      const chatResponse = await axios.post(
        `${API_BASE_URL}/chat?query=${encodeURIComponent(text)}`
      );
      const jarvisReply    = chatResponse.data.response;
      const normalizedParams = chatResponse.data.parameters; // normalized + validated
      const missingFields  = chatResponse.data.missing_fields;

      console.log('[STRUCT] Chat reply:', jarvisReply);
      console.log('[STRUCT] Normalized parameters:', normalizedParams ? 'RECEIVED' : 'none (conversational)');
      if (missingFields) console.log('[STRUCT] Validation failed:', missingFields);

      const formattedReply = `[OUTPUT] ${jarvisReply}`;
      setMessages(prev => [...prev, { role: 'assistant', content: formattedReply }]);
      speakResponse(formattedReply);

      // ── If normalized parameters came back, run simulation ──────────────
      if (normalizedParams) {
        // Map normalized format to solver API format
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
        console.log('[STRUCT] Step 2: Sending to /beam_analysis:', beamParams);

        try {
          const simResponse = await axios.post(`${API_BASE_URL}/beam_analysis`, beamParams);
          const simData = simResponse.data;
          console.log('[STRUCT] Simulation response keys:', Object.keys(simData));
          console.log('[STRUCT] max_stress:', simData.max_stress_mpa, 'MPa');
          console.log('[STRUCT] safety_factor:', simData.safety_factor);
          console.log('[STRUCT] deflection_mm:', simData.deflection_mm, 'mm');
          console.log('[STRUCT] plot_image length:', simData.plot_image?.length ?? 'MISSING');

          setAnalysisData(simData);
          setAnalyzeStatus('COMPLETE');

          // Console keeps full details; chat shows clean professional message
          console.log('[STRUCT] Simulation complete —',
            `ID: ${simData.simulation_id}`,
            `| Max stress: ${simData.max_stress_mpa?.toFixed(1)} MPa`,
            `| Safety factor: ${simData.safety_factor?.toFixed(2)}`,
            `| Max deflection: ${simData.deflection_mm?.toFixed(2)} mm`
          );

          // S.T.R.U.C.T Copilot Workflow Synthesis Workflow
          try {
            const prompt = `[SYSTEM_INJECT] Simulation finished with Max Stress ${simData.max_stress_mpa?.toFixed(1)} MPa, Factor of Safety ${simData.safety_factor?.toFixed(2)}, Deflection ${simData.deflection_mm?.toFixed(2)} mm. Synthesize these results conversationally to the user and proactively suggest exactly one follow-up analysis like buckling or thermal stress. Keep it professional and under 3 sentences.`;
            const syncResponse = await axios.post(`${API_BASE_URL}/chat?query=${encodeURIComponent(prompt)}`);
            const simSynthesis = syncResponse.data.response;
            setMessages(prev => [...prev, {
              role: 'assistant',
              type: 'simulation_meta',
              content: simSynthesis,
              simulation_id: simData.simulation_id,
            }]);
            speakResponse(simSynthesis);
          } catch (e) {
            // Unlikely fallback
            const simMsg = `[ANALYSIS_COMPLETE] Simulation solved successfully. Maximum stress is ${simData.max_stress_mpa?.toFixed(1)} Megapascals. Factor of safety is ${simData.safety_factor?.toFixed(2)}.`;
            setMessages(prev => [...prev, { role: 'assistant', type: 'simulation_meta', content: simMsg, simulation_id: simData.simulation_id }]);
            speakResponse(simMsg);
          }
          setSpeechStatus('IDLE');
        } catch (simErr) {
          const detail = simErr.response?.data?.detail || simErr.message;
          console.error('[STRUCT] /beam_analysis error:', detail);
          setAnalyzeStatus('ERROR');
          setMessages(prev => [...prev, { role: 'assistant', content: `[EXECUTION_FAILED] ${detail}` }]);
        }
      } else {
        setAnalyzeStatus('IDLE'); // Pure conversation — stay idle
      }

    } catch (chatErr) {
      const detail = chatErr.response?.data?.detail || chatErr.message;
      console.error('[STRUCT] /chat error:', detail);
      setAnalyzeStatus('ERROR');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `[CONNECTION_ERROR] ${detail}. Verify that core backend is online.`
      }]);
    } finally {
      setIsAnalyzing(false);
      setSpeechStatus('IDLE');
    }
  };

  // ── File upload handler ────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    console.log('[STRUCT] Input received: image');
    setIsAnalyzing(true);
    setAnalyzeStatus('RUNNING');
    setMessages(prev => [...prev, { role: 'assistant', content: "[PROCESS_STARTED] Computing structural parameters from blueprint diagram." }]);

    const reader = new FileReader();

    reader.onload = async function() {
      const base64 = reader.result;

      try {
        const response = await axios.post(`${API_BASE_URL}/diagram_analysis`, {
          image: base64,
          prompt: "Extract beam length, load, boundary conditions, and dimensions from this engineering diagram"
        });
        
        if (response.data.status === 'clarify') {
          setAnalyzeStatus('IDLE');
          const clarifyMsg = `[VISION_CLARIFY] ${response.data.message}`;
          setMessages(prev => [...prev, { role: 'assistant', content: clarifyMsg }]);
          speakResponse(clarifyMsg);
          return;
        }

        setAnalysisData(response.data);
        setAnalyzeStatus('COMPLETE');
        const extractedType = response.data.parameters?.beam_type ?? 'unknown';
        
        try {
          const prompt = `[SYSTEM_INJECT] Vision analysis complete. Formally acknowledge the extraction of the ${extractedType} beam and inform the user you are solving the system structure.`;
          const syncResponse = await axios.post(`${API_BASE_URL}/chat?query=${encodeURIComponent(prompt)}`);
          setMessages(prev => [...prev, { role: 'assistant', content: syncResponse.data.response }]);
          speakResponse(syncResponse.data.response);
        } catch(e) {
          const msg = `[VISION_COMPLETE] Extracted structural profile for ${extractedType} beam. Results computed.`;
          setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
          speakResponse(msg);
        }
      } catch (err) {
        setAnalyzeStatus('ERROR');
        setMessages(prev => [...prev, { role: 'assistant', content: "[VISION_ERROR] Signal degradation. Unable to parse structural diagram." }]);
      } finally {
        setIsAnalyzing(false);
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="flex h-screen bg-[#050507] text-white p-2 gap-2 overflow-hidden selection:bg-jarvis-blue/30 selection:text-white">
      {/* Background decor */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-jarvis-blue/20 to-transparent"></div>
        <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-jarvis-blue/20 to-transparent"></div>
        <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-jarvis-blue/20 to-transparent"></div>
        <div className="absolute bottom-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-jarvis-blue/20 to-transparent"></div>
      </div>

      <ChatInterface
        messages={messages}
        input={input}
        setInput={setInput}
        handleSend={handleSend}
        speechMode={speechMode}
        toggleSpeechMode={toggleSpeechMode}
        speechStatus={speechStatus}
        liveTranscript={liveTranscript}
        startListening={startListening}
        stopListening={stopListening}
        handleFileUpload={handleFileUpload}
      />

      <AnalysisDashboard
        analysisData={analysisData}
        isAnalyzing={isAnalyzing}
        analyzeStatus={analyzeStatus}
      />
    </div>
  );
};

export default App;
