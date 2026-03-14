import React, { useState } from 'react';
import { Activity, Maximize2, X } from 'lucide-react';

const statusColors = {
  IDLE:     'text-white/40',
  RUNNING:  'text-yellow-400',
  COMPLETE: 'text-green-400',
  ERROR:    'text-red-400',
  Safe:     'text-green-400',
  Warning:  'text-yellow-400',
  Failure:  'text-red-400',
};

const AnalysisDashboard = ({ analysisData, isAnalyzing, analyzeStatus }) => {
  const [modalOpen, setModalOpen] = useState(false);

  // Prefer flat top-level fields, fall back to nested for backward compat
  const maxStressMpa = analysisData?.max_stress_mpa
    ?? (analysisData?.results?.max_stress != null ? analysisData.results.max_stress / 1e6 : null);
  const deflectionMm = analysisData?.deflection_mm
    ?? (analysisData?.results?.max_deflection != null ? Math.abs(analysisData.results.max_deflection) * 1000 : null);
  const safetyFactor = analysisData?.safety_factor
    ?? analysisData?.verification?.factor_of_safety
    ?? null;
  const statusLabel = analyzeStatus === 'COMPLETE'
    ? (analysisData?.status ?? analysisData?.verification?.status ?? 'COMPLETE')
    : analyzeStatus ?? 'IDLE';

  const stats = [
    { label: 'STATUS',        value: statusLabel,                                         color: statusColors[statusLabel] ?? 'text-jarvis-blue' },
    { label: 'MAX STRESS',    value: maxStressMpa != null ? `${maxStressMpa.toFixed(1)} MPa` : '--', color: 'text-red-400' },
    { label: 'SAFETY FACTOR', value: safetyFactor != null ? safetyFactor.toFixed(2) : '--',         color: 'text-green-400' },
    { label: 'DEFLECTION',    value: deflectionMm != null ? `${deflectionMm.toFixed(2)} mm` : '--', color: 'text-jarvis-blue' },
  ];

  const materialName = analysisData?.material?.name
    ?? analysisData?.results?.material
    ?? null;
  const youngsModulus = analysisData?.material?.youngs_modulus;
  const yieldStrength = analysisData?.material?.yield_strength;
  const density       = analysisData?.material?.density;

  return (
    <div className="flex-1 flex flex-col p-2 space-y-2 min-h-0">
      {/* Top Stats Bar */}
      <div className="flex flex-wrap md:flex-nowrap gap-2">
        {stats.map((stat, i) => (
          <div key={i} className="flex-1 min-w-[140px] md:min-w-0 glass-panel flex flex-col justify-center p-4 border-white/5 relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full bg-current ${stat.color} opacity-50`}></div>
            <div className="text-[10px] text-white/40 uppercase font-bold tracking-[0.2em] mb-1">{stat.label}</div>
            <div className={`text-2xl font-extralight tracking-wider glow-text ${stat.color}`}>{stat.value}</div>
            <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
              <Activity size={64} />
            </div>
          </div>
        ))}
      </div>

      {/* Main Plot Area */}
      <div className="flex-1 min-h-[300px] md:min-h-0 glass-panel p-4 md:p-6 relative flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full shadow-glow ${isAnalyzing ? 'bg-yellow-400 animate-pulse' : analysisData ? 'bg-green-400' : 'bg-jarvis-blue animate-pulse'}`}></div>
            <span className="text-xs uppercase tracking-[0.3em] font-bold text-white/60">
              S.T.R.U.C.T — Live FEM Projection
            </span>
          </div>
          <div className="flex gap-4 items-center">
            {analysisData?.simulation_id && (
              <span className="text-[8px] text-white/20 uppercase tracking-widest">
                SIM: {analysisData.simulation_id.slice(0, 8).toUpperCase()}
              </span>
            )}
            <Maximize2
              size={16}
              className="text-white/20 cursor-pointer hover:text-white transition-colors"
              onClick={() => analysisData?.plot_image && setModalOpen(true)}
              title="Click to expand"
            />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center bg-black/40 rounded-xl border border-white/5 overflow-hidden backdrop-blur-xl relative">
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
               style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
          </div>

          {isAnalyzing ? (
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-16 h-16 border-2 border-jarvis-blue/20 rounded-full"></div>
                <div className="w-16 h-16 border-t-2 border-jarvis-blue rounded-full absolute top-0 animate-spin"></div>
              </div>
              <div className="text-sm font-light tracking-[0.2em] text-jarvis-blue animate-pulse uppercase">
                Running Simulation...
              </div>
            </div>
          ) : analysisData?.plot_image ? (
            // ── Render base64 plot — fills the panel ───────────────────────
            <img
              src={`data:image/png;base64,${analysisData.plot_image}`}
              alt="S.T.R.U.C.T Analysis Plot"
              onClick={() => setModalOpen(true)}
              title="Click to expand"
              style={{
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
                maxHeight: '500px',
                cursor: 'zoom-in',
              }}
              className="p-2 drop-shadow-[0_0_20px_rgba(0,210,255,0.15)] rounded-lg"
            />
          ) : analyzeStatus === 'ERROR' ? (
            <div className="flex flex-col items-center gap-3 text-red-400/60">
              <Activity size={48} className="opacity-30" />
              <p className="text-xs tracking-[0.3em] uppercase">Simulation Error — Check Console</p>
            </div>
          ) : (
            <div className="text-white/20 flex flex-col items-center gap-4 group">
              <Activity size={64} className="opacity-10 group-hover:opacity-20 transition-opacity duration-500" />
              <p className="text-xs font-light tracking-[0.3em] uppercase opacity-40">
                System Idle — Awaiting Parameters
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Detail Panels */}
      <div className="flex flex-col md:flex-row h-auto md:h-1/3 gap-2 flex-shrink-0">
        {/* Telemetry Warnings */}
        <div className="flex-[3] min-h-[150px] glass-panel p-5 overflow-y-auto border-white/5 custom-scrollbar">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Telemetry Warnings</div>
            <div className="text-[10px] text-jarvis-blue font-bold">STRUCT_LOG_v5</div>
          </div>
          <div className="space-y-3">
            {(analysisData?.verification?.warnings ?? analysisData?.warnings ?? []).length > 0 ? (
              (analysisData.verification?.warnings ?? analysisData.warnings).map((w, i) => (
                <div key={i} className="text-[11px] p-3 bg-red-500/5 border-l-2 border-red-500/40 text-red-300 font-light tracking-wide flex items-center gap-3">
                  <span className="text-red-500">⚠</span> {w}
                </div>
              ))
            ) : (
              <div className="text-[11px] font-light text-white/20 italic tracking-widest flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-green-500/40"></div>
                {analysisData ? 'All structural parameters within nominal bounds.' : 'System idle — no data.'}
              </div>
            )}
          </div>
        </div>

        {/* Material Profile */}
        <div className="flex-[2] min-h-[200px] glass-panel p-5 border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent">
          <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-4">Material Profile</div>
          {analysisData && materialName ? (
            <div className="space-y-3">
              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <span className="text-[10px] text-white/30 font-bold">DESIGNATION</span>
                <span className="text-xs text-jarvis-blue glow-text font-light tracking-widest">{materialName}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[8px] text-white/20 font-bold mb-1 uppercase">Young's Modulus</div>
                  <div className="text-xs font-light">
                    {youngsModulus ? `${(youngsModulus/1e9).toFixed(1)}` : '—'}
                    <span className="text-[9px] opacity-40 ml-1">GPa</span>
                  </div>
                </div>
                <div>
                  <div className="text-[8px] text-white/20 font-bold mb-1 uppercase">Yield Strength</div>
                  <div className="text-xs font-light">
                    {yieldStrength ? `${(yieldStrength/1e6).toFixed(0)}` : '—'}
                    <span className="text-[9px] opacity-40 ml-1">MPa</span>
                  </div>
                </div>
                <div>
                  <div className="text-[8px] text-white/20 font-bold mb-1 uppercase">Density</div>
                  <div className="text-xs font-light">
                    {density ? density : '—'}
                    <span className="text-[9px] opacity-40 ml-1">kg/m³</span>
                  </div>
                </div>
                <div>
                  <div className="text-[8px] text-white/20 font-bold mb-1 uppercase">Safety Factor</div>
                  <div className={`text-xs font-light ${statusColors[statusLabel] ?? 'text-green-400'}`}>
                    {safetyFactor != null ? safetyFactor.toFixed(2) : '—'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center opacity-20">
              <span className="text-[10px] tracking-[0.4em] uppercase">No Data</span>
            </div>
          )}
        </div>
      </div>
      {/* Click-to-expand modal */}
      <ImageModal
        src={modalOpen && analysisData?.plot_image ? `data:image/png;base64,${analysisData.plot_image}` : null}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};

// ── Full-screen modal (defined inline to avoid extra file) ────────────────
function ImageModal({ src, onClose }) {
  if (!src) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
      >
        <X size={28} />
      </button>
      <img
        src={src}
        alt="Full-size FEM Analysis"
        onClick={e => e.stopPropagation()}
        style={{ width: '90vw', height: '90vh', objectFit: 'contain' }}
        className="rounded-xl shadow-2xl drop-shadow-[0_0_40px_rgba(0,210,255,0.3)]"
      />
    </div>
  );
}

export default AnalysisDashboard;
