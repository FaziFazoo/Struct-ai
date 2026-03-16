import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import LiveVoiceAssistant from './components/LiveVoiceAssistant';
import AnalysisDashboard from './components/AnalysisDashboard';
import { Settings } from 'lucide-react';

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'https://struct-ai-backend-962155187689.us-central1.run.app' 
  : window.location.origin;
const VERSION = 'V1.1.0_PRO_DEPLOY';
console.log(`[S.T.R.U.C.T] VERSION: ${VERSION}`);
console.log('[S.T.R.U.C.T] API_BASE_URL:', API_BASE_URL);

// Stable session ID for this browser tab
const SESSION_ID = `struct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const App = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'S.T.R.U.C.T initialized. Standing by for your command.' }
  ]);
  const [analysisData, setAnalysisData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState('IDLE');

  // Voice pipeline state
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [activeModel, setActiveModel] = useState(localStorage.getItem('gemini_model') || 'gemini-2.5-flash');
  const [universalApiKey, setUniversalApiKey] = useState(localStorage.getItem('universal_api_key') || '');
  const [universalModel, setUniversalModel] = useState(localStorage.getItem('universal_model') || 'gpt-4o');
  const [universalBaseUrl, setUniversalBaseUrl] = useState(localStorage.getItem('universal_base_url') || 'https://api.openai.com/v1');
  const [showSettings, setShowSettings] = useState(!localStorage.getItem('gemini_api_key'));

  // ── Analysis Bridge ──────────────────────────────────────────────────────
  const runAnalysis = useCallback(async (params) => {
    setIsAnalyzing(true);
    setAnalyzeStatus('RUNNING');
    
    // Convert AI params to backend format
    const beamParams = {
      length:         params.length,
      load_magnitude: params.load,
      load_position:  params.load_position || (params.length / 2),
      support_type:   params.type === 'cantilever' ? 'cantilever' : 'simply_supported',
      material:       params.material || 'Steel',
      beam_width:     params.width || 0.1,
      beam_height:    params.height || 0.2,
      session_id:     SESSION_ID,
    };

    try {
      const simResponse = await axios.post(`${API_BASE_URL}/beam_analysis`, beamParams);
      const simData = simResponse.data;
      setAnalysisData(simData);
      setAnalyzeStatus('COMPLETE');
      
      const summary = `Analysis complete for ${beamParams.support_type} beam. Max Stress: ${simData.max_stress_mpa?.toFixed(1)} MPa. Safety Factor: ${simData.safety_factor?.toFixed(2)}.`;
      setMessages(prev => [...prev, { role: 'assistant', content: summary, type: 'simulation_meta', simulation_id: simData.simulation_id }]);
    } catch (err) {
      console.error("Analysis bridge error:", err);
      setAnalyzeStatus('ERROR');
      setMessages(prev => [...prev, { role: 'assistant', content: "Simulation failed. Please check the parameters." }]);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

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
          setMessages(prev => [...prev, { role: 'assistant', content: response.data.message }]);
          return;
        }

        setAnalysisData(response.data);
        setAnalyzeStatus('COMPLETE');
        const extractedType = response.data.parameters?.beam_type ?? 'beam';
        const msg = `Diagram analyzed. Extracted ${extractedType} beam profile. Simulation results computed.`;
        setMessages(prev => [...prev, { role: 'assistant', content: msg }]);

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

      {/* Settings Button */}
      <button 
        className="settings-btn" 
        onClick={() => setShowSettings(true)}
        title="Settings (API Key)"
      >
        <Settings size={20} />
      </button>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <div className="glass" style={{ padding: 32, width: 400, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 14, letterSpacing: '0.2em', textTransform: 'uppercase' }}>System Configuration</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-lo)', textTransform: 'uppercase' }}>Gemini API Key (Google AI Studio)</label>
              <input 
                type="password"
                className="text-input"
                style={{ background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="Enter AI Studio API Key..."
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-lo)', textTransform: 'uppercase' }}>Gemini Model</label>
              <select 
                className="text-input"
                style={{ background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', color: 'white' }}
                value={activeModel}
                onChange={(e) => setActiveModel(e.target.value)}
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash (NEW / Recommended)</option>
                <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash</option>
              </select>
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
            <h3 style={{ fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Demo Safety Net (Universal)</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-lo)' }}>Provider Key (OpenAI/Groq/etc.)</label>
              <input 
                type="password"
                className="text-input"
                style={{ background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                value={universalApiKey}
                onChange={(e) => setUniversalApiKey(e.target.value)}
                placeholder="Alternative API Key..."
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 9, color: 'var(--text-lo)' }}>Base URL</label>
                <input 
                  className="text-input"
                  style={{ background: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 6, fontSize: 11 }}
                  value={universalBaseUrl}
                  onChange={(e) => setUniversalBaseUrl(e.target.value)}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 9, color: 'var(--text-lo)' }}>Model</label>
                <input 
                  className="text-input"
                  style={{ background: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 6, fontSize: 11 }}
                  value={universalModel}
                  onChange={(e) => setUniversalModel(e.target.value)}
                />
              </div>
            </div>

            <button 
              className="layer-tab active" 
              style={{ width: '100%', padding: 12, marginTop: 10 }}
              onClick={() => {
                const cleanKey = geminiApiKey.trim();
                localStorage.setItem('gemini_api_key', cleanKey);
                localStorage.setItem('gemini_model', activeModel);
                localStorage.setItem('universal_api_key', universalApiKey.trim());
                localStorage.setItem('universal_model', universalModel);
                localStorage.setItem('universal_base_url', universalBaseUrl);
                setGeminiApiKey(cleanKey);
                setShowSettings(false);
              }}
            >
              Apply All Configurations
            </button>
          </div>
        </div>
      )}

      <div className="main-layout">
        <LiveVoiceAssistant
          apiKey={geminiApiKey}
          modelId={activeModel}
          backendBaseUrl={API_BASE_URL}
          universalConfig={{
            key: universalApiKey,
            model: universalModel,
            baseUrl: universalBaseUrl
          }}
          onAnalysisRequested={runAnalysis}
          messages={messages}
          setMessages={setMessages}
          analyzeStatus={analyzeStatus}
          handleFileUpload={handleFileUpload}
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
