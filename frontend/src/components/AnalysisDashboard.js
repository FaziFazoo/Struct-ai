import React, { useState } from 'react';
import { Activity, Maximize2, X } from 'lucide-react';

const statusColors = {
  IDLE:     'c-mid',
  RUNNING:  'c-yellow',
  COMPLETE: 'c-green',
  ERROR:    'c-red',
  Safe:     'c-green',
  Warning:  'c-yellow',
  Failure:  'c-red',
};

const AnalysisDashboard = ({ analysisData, isAnalyzing, analyzeStatus }) => {
  const [modalOpen, setModalOpen] = useState(false);

  // Resolve values — prefer flat top-level fields for forward compat
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
    { label: 'STATUS',        value: statusLabel,                                         cls: statusColors[statusLabel] ?? 'c-accent', stripe: '#00d2ff' },
    { label: 'MAX STRESS',    value: maxStressMpa != null ? `${maxStressMpa.toFixed(1)} MPa` : '—', cls: 'c-red',    stripe: '#ff4444' },
    { label: 'SAFETY FACTOR', value: safetyFactor != null ? safetyFactor.toFixed(2)      : '—', cls: 'c-green',  stripe: '#34d399' },
    { label: 'DEFLECTION',    value: deflectionMm != null ? `${deflectionMm.toFixed(2)} mm` : '—', cls: 'c-accent', stripe: '#00d2ff' },
  ];

  const materialName   = analysisData?.material?.name ?? analysisData?.results?.material ?? null;
  const youngsModulus  = analysisData?.material?.youngs_modulus;
  const yieldStrength  = analysisData?.material?.yield_strength;
  const density        = analysisData?.material?.density;

  const dotCls = isAnalyzing
    ? 'plot-panel__dot plot-panel__dot--analyzing'
    : analysisData
      ? 'plot-panel__dot plot-panel__dot--done'
      : 'plot-panel__dot plot-panel__dot--idle';

  return (
    <div className="dashboard">

      {/* ── Stat grid */}
      <div className="stat-grid">
        {stats.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-card__stripe" style={{ background: s.stripe }} />
            <div className="stat-card__label">{s.label}</div>
            <div className={`stat-card__value ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Plot panel */}
      <div className="plot-panel" style={{ flex: 1, minHeight: 0 }}>
        <div className="plot-panel__header">
          <div className="plot-panel__title">
            <div className={dotCls} />
            S.T.R.U.C.T — Live FEM Projection
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {analysisData?.simulation_id && (
              <span style={{ fontSize: 8, color: 'var(--text-lo)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                SIM: {analysisData.simulation_id.slice(0, 8).toUpperCase()}
              </span>
            )}
            <Maximize2
              size={15}
              style={{ color: 'var(--text-lo)', cursor: 'pointer', transition: 'color 0.2s' }}
              onClick={() => analysisData?.plot_image && setModalOpen(true)}
              title="Expand"
              onMouseEnter={e => e.target.style.color = 'white'}
              onMouseLeave={e => e.target.style.color = 'var(--text-lo)'}
            />
          </div>
        </div>

        <div className="plot-canvas">
          <div className="plot-canvas__grid" />
          {isAnalyzing ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <div style={{ position: 'relative', width: 60, height: 60 }}>
                <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(0,210,255,0.15)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', inset: 0, border: '2px solid transparent', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
              </div>
              <span style={{ fontSize: 11, letterSpacing: '0.25em', color: 'var(--accent)', textTransform: 'uppercase', animation: 'pulse 1s ease infinite' }}>
                Running Simulation...
              </span>
            </div>
          ) : analysisData?.plot_image ? (
            <img
              src={`data:image/png;base64,${analysisData.plot_image}`}
              alt="S.T.R.U.C.T Analysis Plot"
              className="plot-img"
              onClick={() => setModalOpen(true)}
              title="Click to expand"
              style={{ filter: 'drop-shadow(0 0 16px rgba(0,210,255,0.12))' }}
            />
          ) : analyzeStatus === 'ERROR' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'rgba(255,68,68,0.5)' }}>
              <Activity size={48} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase' }}>
                Simulation Error — Check Console
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, color: 'var(--text-lo)' }}>
              <Activity size={56} style={{ opacity: 0.12 }} />
              <span style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', opacity: 0.5 }}>
                System Idle — Awaiting Parameters
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom detail panels */}
      <div className="detail-row">
        {/* Telemetry warnings */}
        <div className="warnings-panel">
          <div className="panel-label">Telemetry Warnings</div>
          {(analysisData?.verification?.warnings ?? analysisData?.warnings ?? []).length > 0 ? (
            (analysisData.verification?.warnings ?? analysisData.warnings).map((w, i) => (
              <div key={i} className="warning-item">
                <span style={{ color: 'var(--red)' }}>⚠</span> {w}
              </div>
            ))
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-lo)', fontStyle: 'italic', letterSpacing: '0.05em' }}>
              {analysisData ? '✓ All structural parameters within nominal bounds.' : 'System idle — no data.'}
            </div>
          )}
        </div>

        {/* Material profile */}
        <div className="material-panel">
          <div className="panel-label">Material Profile</div>
          {analysisData && materialName ? (
            <>
              <div className="mat-name">{materialName}</div>
              <div className="mat-grid">
                <div className="mat-item">
                  <div className="mat-item__label">Young's Modulus</div>
                  <div className="mat-item__val">
                    {youngsModulus ? (youngsModulus / 1e9).toFixed(1) : '—'}
                    <span className="mat-item__unit">GPa</span>
                  </div>
                </div>
                <div className="mat-item">
                  <div className="mat-item__label">Yield Strength</div>
                  <div className="mat-item__val">
                    {yieldStrength ? (yieldStrength / 1e6).toFixed(0) : '—'}
                    <span className="mat-item__unit">MPa</span>
                  </div>
                </div>
                <div className="mat-item">
                  <div className="mat-item__label">Density</div>
                  <div className="mat-item__val">
                    {density ?? '—'}
                    <span className="mat-item__unit">kg/m³</span>
                  </div>
                </div>
                <div className="mat-item">
                  <div className="mat-item__label">Safety Factor</div>
                  <div className={`mat-item__val ${statusColors[statusLabel] ?? 'c-green'}`}>
                    {safetyFactor != null ? safetyFactor.toFixed(2) : '—'}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
              No Data
            </div>
          )}
        </div>
      </div>

      {/* ── Full-screen modal */}
      {modalOpen && analysisData?.plot_image && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <button className="modal-close" onClick={() => setModalOpen(false)} aria-label="Close">
            <X size={28} />
          </button>
          <img
            src={`data:image/png;base64,${analysisData.plot_image}`}
            alt="Full-size FEM Analysis"
            className="modal-img"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

// Inject spinner keyframe once (can't use @keyframes inside component)
if (!document.getElementById('dash-spin-style')) {
  const s = document.createElement('style');
  s.id = 'dash-spin-style';
  s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(s);
}

export default AnalysisDashboard;
