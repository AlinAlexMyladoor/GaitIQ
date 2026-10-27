import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, CartesianGrid } from 'recharts';
import { Pause, Play, RotateCcw, Activity } from 'lucide-react';
import { SENSORS, decimate } from '../utils/sensors';

const TIME_RANGES = [
  { label: '30 s', ms: 30_000 },
  { label: '1 min', ms: 60_000 },
  { label: '5 min', ms: 300_000 },
];

const fmtTime = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour12: false });

function ChartTooltip({ active, payload, label, thresholdNorm }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', boxShadow: 'var(--shadow-lg)', minWidth: 160 }}>
      <div className="mono" style={{ color: 'var(--t3)', fontSize: 11.5, paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid var(--border-soft)' }}>{fmtTime(label)}</div>
      {payload.map((item) => {
        const ch = SENSORS.find((c) => c.id === item.dataKey);
        const over = item.value >= thresholdNorm;
        return (
          <div key={item.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 12.5, padding: '2px 0' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--t2)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: ch?.color }} />{ch?.short}
            </span>
            <strong className="num" style={{ color: over ? 'var(--danger)' : 'var(--t1)' }}>{item.value}%</strong>
          </div>
        );
      })}
    </div>
  );
}

export default function AmbulatoryChart({
  history = [], thresholdNorm = 78, isPaused, onTogglePause, onClearHistory,
  dataSource, isStale = false, onSwitchToSimulation,
}) {
  const [rangeIdx, setRangeIdx] = useState(0);
  const [vis, setVis] = useState({ greatToe: true, firstMetatarsal: true, fifthMetatarsal: true, heel: true });
  const windowMs = TIME_RANGES[rangeIdx].ms;

  const chartData = useMemo(() => {
    if (!history.length) return [];
    const cutoff = history[history.length - 1].timestamp - windowMs;
    return decimate(history.filter((h) => h.timestamp >= cutoff), 260);
  }, [history, windowMs]);

  const emptyNotice = useMemo(() => {
    if (dataSource === 'firebase') {
      if (isStale) return 'Telemetry stream stalled — no packet received recently';
      return 'Awaiting telemetry frames from STM32 Blue Pill…';
    }
    if (isPaused) return 'Recording paused';
    return 'Synthetic stream idle — select an active scenario';
  }, [dataSource, isStale, isPaused]);

  return (
    <section className="card card-pad animate-in delay-3" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="card-head">
        <div>
          <h2 className="card-title">Telemetry stream {isPaused && <span className="pill pill-warn">Paused</span>}</h2>
          <p className="card-sub num">{chartData.length} samples · last {TIME_RANGES[rangeIdx].label}</p>
        </div>

        <div className="chart-controls">
          <div className="chart-toggles">
            {SENSORS.map((ch) => (
              <button key={ch.id} type="button" className="chip" aria-pressed={vis[ch.id]} onClick={() => setVis((p) => ({ ...p, [ch.id]: !p[ch.id] }))} title={`Toggle ${ch.name}`}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: vis[ch.id] ? ch.color : 'var(--t3)' }} />{ch.short}
              </button>
            ))}
          </div>
          <div className="chart-actions">
            <div className="seg" role="group" aria-label="Time window">
              {TIME_RANGES.map((r, i) => (
                <button key={r.label} type="button" aria-pressed={rangeIdx === i} onClick={() => setRangeIdx(i)}>{r.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button id="btn-chart-pause" type="button" className="btn btn-icon btn-sm" onClick={onTogglePause} title={isPaused ? 'Resume recording' : 'Pause recording'}>
                {isPaused ? <Play size={14} /> : <Pause size={14} />}
              </button>
              <button id="btn-chart-clear" type="button" className="btn btn-icon btn-sm" onClick={onClearHistory} title="Reset telemetry buffer">
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {chartData.length < 2 ? (
        <div className="chart-empty">
          <div className="empty">
            <div className="empty-icon"><Activity size={20} /></div>
            <span>{emptyNotice}</span>
            {dataSource === 'firebase' && onSwitchToSimulation && (
              <button type="button" className="btn btn-soft btn-sm" onClick={onSwitchToSimulation}>Switch to simulation</button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
              <defs>
                {SENSORS.map((ch) => (
                  <linearGradient key={ch.id} id={`fill-${ch.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ch.color} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={ch.color} stopOpacity="0" />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border-soft)" />
              <XAxis dataKey="timestamp" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtTime} tick={{ fill: 'var(--t3)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={70} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: 'var(--t3)', fontSize: 11 }} tickLine={false} axisLine={false} width={42} />
              <Tooltip content={<ChartTooltip thresholdNorm={thresholdNorm} />} cursor={{ stroke: 'var(--primary)', strokeOpacity: 0.35, strokeWidth: 1 }} />
              <ReferenceArea y1={thresholdNorm} y2={100} fill="var(--danger)" fillOpacity={0.06} />
              <ReferenceLine y={thresholdNorm} stroke="var(--danger)" strokeDasharray="5 4" strokeOpacity={0.8}
                label={{ value: `Alert ${thresholdNorm}%`, fill: 'var(--danger)', fontSize: 11, position: 'insideTopRight', fontWeight: 600 }} />
              {SENSORS.map((ch) => vis[ch.id] && (
                <Area key={ch.id} type="monotone" dataKey={ch.id} stroke={ch.color} strokeWidth={2} fill={`url(#fill-${ch.id})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }} isAnimationActive={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
