import React from 'react';
import { Volume2, VolumeX, Download, Printer, Info, Send } from 'lucide-react';

const PRESETS = [
  { label: 'Alert', value: 50 },
  { label: 'Standard', value: 75 },
  { label: 'High', value: 90 },
];

export default function SessionSummary({
  peakOverallNorm = 0, peakSensorName = '—', timeAboveThresholdMs = 0, alertCount = 0,
  forefootPct = 50, thresholdNorm = 50, onThresholdChange,
  soundAlert, onToggleSound, onExportCSV, onPrint, onSendSummary, telegramReady = false,
}) {
  const heelPct = 100 - forefootPct;
  const sliderFill = Math.round(((thresholdNorm - 30) / (98 - 30)) * 100);

  return (
    <section className="card card-pad animate-in delay-3" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card-head" style={{ marginBottom: 0 }}>
        <div>
          <h2 className="card-title">Session overview</h2>
          <p className="card-sub">Cumulative telemetry and load distribution</p>
        </div>
        <div className="session-actions">
          <button id="btn-audio-toggle" type="button" className={`btn btn-sm ${soundAlert ? 'btn-active' : ''}`} onClick={onToggleSound} title="Audible warning when a threshold is crossed">
            {soundAlert ? <Volume2 size={14} /> : <VolumeX size={14} />}{soundAlert ? 'Audio on' : 'Muted'}
          </button>
          <button id="btn-export-csv" type="button" className="btn btn-sm" onClick={onExportCSV}><Download size={14} />CSV</button>
          <button id="btn-print" type="button" className="btn btn-sm" onClick={onPrint}><Printer size={14} />Report</button>
          {onSendSummary && (
            <button id="btn-telegram-summary" type="button" className={`btn btn-sm ${telegramReady ? 'btn-soft' : ''}`} onClick={onSendSummary} title={telegramReady ? 'Send this session summary to Telegram' : 'Set up Telegram to share summaries'}>
              <Send size={14} />Telegram
            </button>
          )}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="eyebrow">Peak pressure</div>
          <div className="kpi-value num" style={{ color: peakOverallNorm >= thresholdNorm ? 'var(--danger)' : undefined }}>{peakOverallNorm}%</div>
          <div className="kpi-sub">{peakSensorName}</div>
        </div>
        <div className="kpi">
          <div className="eyebrow">Time over limit</div>
          <div className="kpi-value num" style={{ color: timeAboveThresholdMs > 0 ? 'var(--warn)' : undefined }}>{(timeAboveThresholdMs / 1000).toFixed(1)}<span style={{ fontSize: 16, color: 'var(--t3)' }}> s</span></div>
          <div className="kpi-sub">Current session</div>
        </div>
        <div className="kpi">
          <div className="eyebrow">Alert events</div>
          <div className="kpi-value num" style={{ color: alertCount > 0 ? 'var(--danger)' : undefined }}>{alertCount}</div>
          <div className="kpi-sub">Recorded</div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 650 }}>Load distribution</span>
          <span style={{ fontSize: 12, color: 'var(--t2)' }}>Forefoot vs heel</span>
        </div>
        <div className="split-bar">
          <div style={{ width: `${forefootPct}%`, background: 'var(--primary)' }} />
          <div style={{ width: `${heelPct}%`, background: 'var(--s-heel)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t2)', marginTop: 7 }}>
          <span>Forefoot <strong className="num" style={{ color: 'var(--primary)' }}>{forefootPct}%</strong></span>
          <span>Heel <strong className="num" style={{ color: 'var(--s-heel)' }}>{heelPct}%</strong></span>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 650 }}>Alert threshold</span>
          <span className="pill pill-primary num" style={{ fontSize: 12.5 }}>{thresholdNorm}%</span>
        </div>
        <input type="range" min={30} max={98} step={1} value={thresholdNorm} style={{ '--pct': `${sliderFill}%` }}
          onChange={(e) => onThresholdChange && onThresholdChange(Number(e.target.value))} aria-label="Alert threshold" />
        <div className="no-print session-presets">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="chip" aria-pressed={thresholdNorm === p.value} onClick={() => onThresholdChange && onThresholdChange(p.value)}>
              {p.label} · {p.value}%
            </button>
          ))}
        </div>
      </div>

      <div className="disclaimer">
        <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Diabetic peripheral neuropathy research prototype. The alert threshold supports research monitoring and is not a clinical diagnosis or validated injury-risk prediction.</span>
      </div>
    </section>
  );
}
