import React, { useMemo } from 'react';
import { SENSORS } from '../utils/sensors';
import Sparkline from './Sparkline';

export default function PressureCards({
  sensorNorm = {},
  peakNorm = {},
  rawSensorData = {},
  history = [],
  thresholdNorm = 50,
  showDiagnostics = false,
  selectedSensor = null,
  onSelectSensor,
}) {
  // Last ~6 seconds of each channel for sparklines
  const recent = useMemo(() => history.slice(-60), [history]);

  return (
    <div className="grid-cards">
      {SENSORS.map((s, idx) => {
        const current = sensorNorm[s.id] ?? 0;
        const peak = peakNorm[s.id] ?? 0;
        const raw = rawSensorData?.[s.id] ?? 0;
        const isOver = current >= thresholdNorm;
        const isElevated = !isOver && current >= thresholdNorm * 0.8;
        const series = recent.map((h) => h[s.id] ?? 0);

        return (
          <article
            key={s.id}
            className={`card sensor animate-in delay-${idx + 1} ${isOver ? 'is-over' : ''} ${selectedSensor === s.id ? 'is-selected' : ''}`}
            style={{ '--c': s.color, cursor: onSelectSensor ? 'pointer' : 'default' }}
            onClick={() => onSelectSensor && onSelectSensor(s.id)}
          >
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span className="sensor-icon">{s.code}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 650, letterSpacing: '-0.02em' }}>{s.name}</div>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--t3)' }}>{s.short}</div>
                </div>
              </div>
              {isOver ? (
                <span className="pill pill-danger"><span className="dot dot-danger dot-live" />Overload</span>
              ) : isElevated ? (
                <span className="pill pill-warn">Elevated</span>
              ) : (
                <span className="pill pill-muted">Normal</span>
              )}
            </header>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
              <div className="sensor-value num" style={{ color: isOver ? 'var(--danger)' : 'var(--t1)' }}>
                {current}
                <small>%</small>
              </div>
              <div style={{ width: '48%', minWidth: 70 }}>
                <Sparkline values={series} color={isOver ? 'var(--danger)' : s.color} threshold={thresholdNorm} />
              </div>
            </div>

            <div>
              <div className="meter" role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.name} load`}>
                <div className="meter-fill" style={{ width: `${Math.min(100, Math.max(0, current))}%`, background: isOver ? 'var(--danger)' : s.color }} />
                <span className="meter-mark" style={{ left: `${thresholdNorm}%` }} title={`Alert threshold ${thresholdNorm}%`} />
              </div>
            </div>

            <footer className="sensor-foot">
              <span>Peak <strong className="num">{peak}%</strong></span>
              {showDiagnostics ? (
                <span className="mono" style={{ color: 'var(--t3)' }}>{raw} ADC</span>
              ) : (
                <span>Limit <strong className="num">{thresholdNorm}%</strong></span>
              )}
            </footer>
          </article>
        );
      })}
    </div>
  );
}
