// Shared sensor definitions & formatting helpers (single source of truth for the UI)

export const SENSORS = [
  { id: 'greatToe',        name: 'Great Toe',      short: 'Hallux',    code: 'T1',  color: 'var(--s-toe)'  },
  { id: 'firstMetatarsal', name: '1st Metatarsal', short: 'MTH1',      code: 'M1',  color: 'var(--s-met1)' },
  { id: 'fifthMetatarsal', name: '5th Metatarsal', short: 'MTH5',      code: 'M5',  color: 'var(--s-met5)' },
  { id: 'heel',            name: 'Heel',           short: 'Calcaneus', code: 'H',   color: 'var(--s-heel)' },
];

export const SENSOR_BY_ID = Object.fromEntries(SENSORS.map((s) => [s.id, s]));

export const EMPTY_READINGS = { greatToe: 0, firstMetatarsal: 0, fifthMetatarsal: 0, heel: 0 };

/** Pressure heat colour: cool cyan (0%) → green → yellow → red (100%). */
export const heatColor = (pct = 0, alpha = 1) => {
  const p = Math.min(100, Math.max(0, pct));
  return `hsl(${Math.round(190 - p * 1.9)} 85% 52% / ${alpha})`;
};

/** 75 → "01:15", 3725 → "1:02:05" */
export const formatClock = (totalSeconds = 0) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** Keep at most `max` points, evenly strided, always retaining the last sample. */
export const decimate = (arr, max = 260) => {
  if (arr.length <= max) return arr;
  const stride = Math.ceil(arr.length / max);
  const out = [];
  for (let i = 0; i < arr.length; i += stride) out.push(arr[i]);
  const last = arr[arr.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
};
