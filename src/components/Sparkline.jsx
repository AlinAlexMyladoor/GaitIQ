import React, { useId, useMemo } from 'react';

/** Lightweight SVG sparkline for 0–100 series. */
export default function Sparkline({ values = [], color = 'var(--primary)', threshold, height = 40 }) {
  const gid = useId().replace(/:/g, '');
  const W = 200;
  const H = height;

  const { line, area } = useMemo(() => {
    if (values.length < 2) return { line: '', area: '' };
    const step = W / (values.length - 1);
    const pts = values.map((v, i) => [i * step, H - 3 - (Math.min(100, Math.max(0, v)) / 100) * (H - 6)]);
    const l = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return { line: l, area: `${l} L${W},${H} L0,${H} Z` };
  }, [values, H]);

  const thresholdY = threshold != null ? H - 3 - (threshold / 100) * (H - 6) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sp-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {thresholdY != null && (
        <line x1="0" x2={W} y1={thresholdY} y2={thresholdY} stroke="var(--danger)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" vectorEffect="non-scaling-stroke" />
      )}
      {area && <path d={area} fill={`url(#sp-${gid})`} />}
      {line && <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}
