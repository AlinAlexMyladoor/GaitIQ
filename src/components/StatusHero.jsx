import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, TriangleAlert, RadioTower, Footprints, Timer, Scale, Waves } from 'lucide-react';
import { formatClock } from '../utils/sensors';

const COPY = {
  ok:     { icon: ShieldCheck,   title: 'Within safe range',     desc: 'All plantar sites are below the configured alert threshold.' },
  warn:   { icon: TriangleAlert, title: 'Load approaching limit', desc: 'A plantar site is nearing the alert threshold. Monitor closely.' },
  danger: { icon: ShieldAlert,   title: 'Threshold exceeded',     desc: 'Sustained pressure detected. Prompt the subject to offload.' },
  idle:   { icon: RadioTower,    title: 'Awaiting telemetry',     desc: 'No live packets yet. Check the insole power or switch to simulation.' },
};

function Gauge({ value, threshold, active }) {
  const R = 78;
  const angle = Math.PI * (1 - threshold / 100);
  const tx = (r) => 100 + r * Math.cos(angle);
  const ty = (r) => 100 - r * Math.sin(angle);

  return (
    <div style={{ position: 'relative', width: 210 }}>
      <svg viewBox="0 0 200 118" width="100%" role="img" aria-label={`Peak current load ${value} percent, threshold ${threshold} percent`}>
        <path d="M 22 100 A 78 78 0 0 1 178 100" fill="none" stroke="var(--surface-3)" strokeWidth="13" strokeLinecap="round" pathLength="100" />
        <path
          d="M 22 100 A 78 78 0 0 1 178 100"
          fill="none"
          stroke="var(--state)"
          strokeWidth="13"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${active ? Math.max(0.5, Math.min(100, value)) : 0} 100`}
          style={{ transition: 'stroke-dasharray 0.25s linear, stroke 0.3s' }}
        />
        <line x1={tx(R - 12)} y1={ty(R - 12)} x2={tx(R + 12)} y2={ty(R + 12)} stroke="var(--t1)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 2, textAlign: 'center' }}>
        <div className="num" style={{ fontSize: 34, fontWeight: 750, lineHeight: 1, letterSpacing: '-0.04em', color: 'var(--t1)' }}>
          {active ? value : '—'}<span style={{ fontSize: 15, color: 'var(--t3)', fontWeight: 600 }}>{active ? '%' : ''}</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 3 }}>Highest site load</div>
      </div>
    </div>
  );
}

export default function StatusHero({
  status = 'idle',
  maxLoad = 0,
  hottestName = '—',
  thresholdNorm = 50,
  gaitPhase = '—',
  sessionStart,
  forefootPct = 50,
  dataSource = 'simulator',
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => setElapsed((Date.now() - sessionStart) / 1000);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [sessionStart]);

  const { icon: Icon, title, desc } = COPY[status];
  const active = status !== 'idle';

  const detail =
    status === 'danger' ? `${hottestName} is at ${maxLoad}% — above the ${thresholdNorm}% limit.`
    : status === 'warn' ? `${hottestName} is at ${maxLoad}% — limit is ${thresholdNorm}%.`
    : desc;

  return (
    <section className={`card hero is-${status} animate-in`} aria-live="polite">
      <div className="hero-main">
        <div className="hero-icon"><Icon size={26} strokeWidth={2} /></div>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">Plantar load status</div>
          <h1 className="hero-title">{title}</h1>
          <p className="hero-desc">{detail}</p>
        </div>
      </div>

      <Gauge value={maxLoad} threshold={thresholdNorm} active={active} />

      <div className="hero-stats">
        <div className="stat">
          <div className="stat-label"><Footprints size={13} />Gait phase</div>
          <div className="stat-value" title={gaitPhase} style={{ fontSize: 14.5 }}>{gaitPhase}</div>
        </div>
        <div className="stat">
          <div className="stat-label"><Timer size={13} />Session</div>
          <div className="stat-value num">{formatClock(elapsed)}</div>
        </div>
        <div className="stat">
          <div className="stat-label"><Scale size={13} />Fore / Heel</div>
          <div className="stat-value num">{active ? `${forefootPct} / ${100 - forefootPct}` : '— / —'}</div>
        </div>
        <div className="stat">
          <div className="stat-label"><Waves size={13} />Source</div>
          <div className="stat-value" style={{ fontSize: 14.5 }}>{dataSource === 'firebase' ? 'Live · STM32' : 'Simulation'}</div>
        </div>
      </div>
    </section>
  );
}
