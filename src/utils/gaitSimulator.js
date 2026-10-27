// Deterministic Gait Cycle Pressure Simulator for Insole Research
// Completely isolated from live telemetry pipeline.

export const SIMULATION_SCENARIOS = {
  NORMAL_WALK: {
    id: 'NORMAL_WALK',
    label: 'Normal walk (Balanced)',
    cadence: 96,
  },
  FOREFOOT_LOADING: {
    id: 'FOREFOOT_LOADING',
    label: 'Forefoot bias (Metatarsal loading)',
    cadence: 88,
  },
  SUSTAINED_THRESHOLD: {
    id: 'SUSTAINED_THRESHOLD',
    label: 'Sustained over-threshold test',
    cadence: 75,
  },
  SENSOR_DISCONNECT: {
    id: 'SENSOR_DISCONNECT',
    label: 'Sensor disconnect (MTH5 open lead)',
    cadence: 90,
  },
  STALE_TELEMETRY: {
    id: 'STALE_TELEMETRY',
    label: 'Stale telemetry test (Halted stream)',
    cadence: 0,
  },
};

let stepProgress = 0;

export function generateSimulatedStep(scenarioKey = 'NORMAL_WALK', threshold = 3200, maxAdc = 4095) {
  if (scenarioKey === 'STALE_TELEMETRY') {
    // Returns null to simulate a hardware stall / no new packet generated
    return null;
  }

  const scenario = SIMULATION_SCENARIOS[scenarioKey] || SIMULATION_SCENARIOS.NORMAL_WALK;
  const stepRate = scenario.cadence / 60; // steps/sec
  const dt = 0.1; // 100ms tick
  stepProgress = (stepProgress + (stepRate * dt)) % 1;

  let heel = 0;
  let fifthMetatarsal = 0;
  let firstMetatarsal = 0;
  let greatToe = 0;
  let phase = 'Swing Phase (Unloaded)';

  // Stance phase is ~60% of gait cycle (0 to 0.6)
  if (stepProgress < 0.6) {
    const stanceT = stepProgress / 0.6;

    if (stanceT < 0.25) {
      phase = 'Heel Strike (Contact)';
      const hCurve = Math.sin((stanceT / 0.25) * Math.PI);
      heel = Math.round(620 * hCurve);
      fifthMetatarsal = Math.round(40 * hCurve);
      firstMetatarsal = 15;
      greatToe = 10;
    } else if (stanceT < 0.55) {
      phase = 'Midstance (Full Foot)';
      const midT = (stanceT - 0.25) / 0.3;
      heel = Math.round(480 - midT * 320);
      fifthMetatarsal = Math.round(260 + Math.sin(midT * Math.PI) * 220);
      firstMetatarsal = Math.round(240 + Math.sin(midT * Math.PI) * 290);
      greatToe = Math.round(140 + midT * 180);
    } else {
      phase = 'Forefoot Push-Off';
      const pushT = (stanceT - 0.55) / 0.45;
      heel = Math.max(0, Math.round(50 * (1 - pushT)));
      fifthMetatarsal = Math.round(140 * (1 - pushT));
      firstMetatarsal = Math.round(420 + Math.sin(pushT * Math.PI) * 150);
      greatToe = Math.round(470 + Math.sin(pushT * Math.PI) * 170);

      if (scenarioKey === 'FOREFOOT_LOADING') {
        firstMetatarsal = Math.round(firstMetatarsal * 1.55);
        greatToe = Math.round(greatToe * 1.45);
      }
    }
  } else {
    phase = 'Swing Phase (Unloaded)';
    heel = 8;
    fifthMetatarsal = 6;
    firstMetatarsal = 6;
    greatToe = 5;
  }

  const scale = (maxAdc || 4095) / 1023;

  // Sustained threshold scenario: force MTH1 over threshold
  if (scenarioKey === 'SUSTAINED_THRESHOLD') {
    firstMetatarsal = Math.max(threshold + Math.round(65 * scale), Math.round(firstMetatarsal * scale));
    phase = 'Sustained Forefoot Load';
  }

  // Sensor disconnect scenario: MTH5 drops to 0 (open lead)
  if (scenarioKey === 'SENSOR_DISCONNECT') {
    fifthMetatarsal = 0;
  }

  return {
    sensorData: {
      greatToe: Math.min(maxAdc, Math.round(Math.max(0, greatToe) * scale)),
      firstMetatarsal: scenarioKey === 'SUSTAINED_THRESHOLD' ? firstMetatarsal : Math.min(maxAdc, Math.round(Math.max(0, firstMetatarsal) * scale)),
      fifthMetatarsal: Math.min(maxAdc, Math.round(Math.max(0, fifthMetatarsal) * scale)),
      heel: Math.min(maxAdc, Math.round(Math.max(0, heel) * scale)),
    },
    phase,
  };
}
