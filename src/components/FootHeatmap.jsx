import React, { useState } from 'react';
import { SENSORS, heatColor } from '../utils/sensors';

const NODES = [
  { id: 'greatToe',        cx: 98,  cy: 66,  r: 22 },
  { id: 'firstMetatarsal', cx: 88,  cy: 160, r: 22 },
  { id: 'fifthMetatarsal', cx: 172, cy: 174, r: 22 },
  { id: 'heel',            cx: 128, cy: 338, r: 31 },
].map((n) => ({ ...n, ...SENSORS.find((s) => s.id === n.id) }));

export default function FootHeatmap({ sensorNorm = {}, peakNorm = {}, thresholdNorm = 78, selectedSensor, onSelectSensor }) {
  const [hovered, setHovered] = useState(null);
  const activeId = hovered || selectedSensor;
  const activeNode = NODES.find((n) => n.id === activeId);

  return (
    <section className="card card-pad animate-in delay-2" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="card-head" style={{ marginBottom: 6 }}>
        <div>
          <h2 className="card-title">Plantar pressure map <span className="pill pill-primary">Right foot</span></h2>
          <p className="card-sub">4-channel piezoresistive array</p>
        </div>
        <span className="num" style={{ fontSize: 13, fontWeight: 650, color: activeNode ? 'var(--primary)' : 'var(--t3)', minHeight: 20 }}>
          {activeNode ? `${activeNode.short} · ${sensorNorm[activeNode.id] ?? 0}%` : 'Hover a sensor'}
        </span>
      </div>

      <div className="foot-wrap">
        <svg viewBox="0 0 260 420" className="foot-svg" onMouseLeave={() => setHovered(null)} role="img" aria-label="Right foot plantar pressure map">
          <defs>
            <linearGradient id="footFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--foot-fill-a)" />
              <stop offset="100%" stopColor="var(--foot-fill-b)" />
            </linearGradient>
            {NODES.map((n) => {
              const p = sensorNorm[n.id] ?? 0;
              return (
                <radialGradient id={`heat-${n.id}`} key={n.id}>
                  <stop offset="0%" stopColor={heatColor(p, 0.95)} />
                  <stop offset="55%" stopColor={heatColor(p, 0.55)} />
                  <stop offset="100%" stopColor={heatColor(p, 0)} />
                </radialGradient>
              );
            })}
          </defs>

          <path
            d="M 98,25 C 120,24 135,32 145,45 C 155,58 175,68 185,85 C 195,102 200,135 198,170 C 196,200 185,230 178,260 C 170,290 168,310 165,340 C 160,375 150,395 128,398 C 108,400 95,375 92,345 C 89,315 88,285 85,255 C 80,215 72,175 75,135 C 77,100 80,45 98,25 Z"
            fill="url(#footFill)" stroke="var(--foot-stroke)" strokeWidth="2"
          />
          <path d="M 92,195 C 106,238 108,280 96,322" fill="none" stroke="var(--foot-stroke)" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.7" />
          <line x1="128" y1="50" x2="128" y2="370" stroke="var(--foot-stroke)" strokeWidth="1" strokeDasharray="2 6" opacity="0.5" />

          {NODES.map((n) => {
            const p = sensorNorm[n.id] ?? 0;
            const over = p >= thresholdNorm;
            const targeted = activeId === n.id;
            const blobR = n.r * (1.15 + (p / 100) * 1.35);
            return (
              <g key={n.id} className="foot-node" onMouseEnter={() => setHovered(n.id)} onClick={() => onSelectSensor && onSelectSensor(n.id)}>
                <circle cx={n.cx} cy={n.cy} r={blobR} fill={`url(#heat-${n.id})`} opacity={p > 2 ? 1 : 0.15} style={{ transition: 'r 0.18s linear' }} />
                {over && <circle cx={n.cx} cy={n.cy} r={n.r + 8} fill="none" stroke="var(--danger)" strokeWidth="1.5" opacity="0.7">
                  <animate attributeName="r" values={`${n.r + 4};${n.r + 14}`} dur="1.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0" dur="1.4s" repeatCount="indefinite" />
                </circle>}
                <circle cx={n.cx} cy={n.cy} r={n.r} fill="var(--surface)" fillOpacity="0.35" stroke={over ? 'var(--danger)' : n.color} strokeWidth={targeted ? 3 : 2} />
                <circle cx={n.cx} cy={n.cy} r="3.2" fill={over ? 'var(--danger)' : n.color} />
                <text x={n.cx} y={n.cy + n.r + 17} textAnchor="middle" fill="var(--t1)" fontSize="12" fontWeight="650" fontFamily="Figtree, system-ui, sans-serif">{n.short}</text>
                <text x={n.cx} y={n.cy + n.r + 31} textAnchor="middle" fill={over ? 'var(--danger)' : 'var(--t2)'} fontSize="11.5" fontWeight="650" fontFamily="IBM Plex Mono, monospace">{p}%</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ margin: '4px 0 14px' }}>
        <div className="legend-bar" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t3)', marginTop: 5 }}>
          <span>Low</span><span>Pressure intensity</span><span>High</span>
        </div>
      </div>

      <div className="foot-sites-grid">
        {NODES.map((n) => {
          const p = sensorNorm[n.id] ?? 0;
          const over = p >= thresholdNorm;
          return (
            <button key={n.id} type="button" className="site-row" aria-pressed={activeId === n.id} onClick={() => onSelectSensor && onSelectSensor(n.id)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: over ? 'var(--danger)' : n.color }} />
                <span style={{ fontSize: 12.5, fontWeight: 620, color: over ? 'var(--danger)' : 'var(--t1)' }}>{n.short}</span>
              </span>
              <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: over ? 'var(--danger)' : 'var(--t1)' }}>
                {p}% <span style={{ fontWeight: 500, color: 'var(--t3)', fontSize: 11 }}>pk {peakNorm[n.id] ?? 0}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
