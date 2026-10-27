import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { db, ref, onValue, set, getFirebaseConnectionInfo } from './firebase';
import toast, { Toaster } from 'react-hot-toast';
import {
  Settings, Send, Search, Sun, Moon, Maximize2, Minimize2, Radio, FlaskConical,
  RefreshCw, Download, Printer, Pause, Play, Volume2, VolumeX, RotateCcw, Sliders, CheckCheck, Palette,
} from 'lucide-react';

import StatusHero from './components/StatusHero';
import PressureCards from './components/PressureCards';
import FootHeatmap from './components/FootHeatmap';
import AmbulatoryChart from './components/AmbulatoryChart';
import SessionSummary from './components/SessionSummary';
import EventLog from './components/EventLog';
import DeviceHealth from './components/DeviceHealth';
import SettingsModal from './components/SettingsModal';
import Logo from './components/Logo';
import CommandPalette from './components/CommandPalette';

import useTheme from './hooks/useTheme';
import { SENSORS, SENSOR_BY_ID, EMPTY_READINGS, formatClock } from './utils/sensors';
import { generateSimulatedStep, SIMULATION_SCENARIOS } from './utils/gaitSimulator';
import { playWarningBeep } from './utils/audioAlert';
import {
  getStoredCaretakerConfig, saveCaretakerConfig, dispatchNotification, dispatchOffline, dispatchSummary, isTelegramReady,
} from './utils/caretakerNotifier';

const STALE_TIMEOUT_MS = 5000;
const HISTORY_LIMIT = 3200; // ~5 min at 10 Hz so the 1 min / 5 min chart windows are real

const downloadFile = (name, content, type = 'text/csv') => {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type })),
    download: name,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export default function App() {
  const { theme, toggleTheme } = useTheme();

  // ── Source Selection & Modes ─────────────────────────────────────────
  const [dataSource, setDataSource] = useState(() => (getFirebaseConnectionInfo().isConfigured ? 'firebase' : 'simulator')); // 'firebase' | 'simulator'
  const [simScenarioKey, setSimScenarioKey] = useState('NORMAL_WALK');
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isReceivingTelemetry, setIsReceivingTelemetry] = useState(false);
  const [isStale, setIsStale] = useState(false);

  // ── Sensor Configuration ─────────────────────────────────────────────
  const [adcResolution, setAdcResolution] = useState(4095);
  const [fsrMapping, setFsrMapping] = useState(() => {
    try {
      const s = localStorage.getItem('smart_insole_fsr_mapping');
      if (s) return JSON.parse(s);
    } catch { /* ignore */ }
    return { greatToe: 'fsr1', firstMetatarsal: 'fsr2', fifthMetatarsal: 'fsr3', heel: 'fsr4' };
  });
  const [tareOffsets, setTareOffsets] = useState({ ...EMPTY_READINGS });

  // ── Telemetry State ──────────────────────────────────────────────────
  const [rawSensorData, setRawSensorData] = useState({ ...EMPTY_READINGS });
  const [sensorNorm, setSensorNorm] = useState({ ...EMPTY_READINGS });
  const [peakNorm, setPeakNorm] = useState({ ...EMPTY_READINGS });
  const [thresholdNorm, setThresholdNorm] = useState(78);
  const [history, setHistory] = useState([]);
  const [gaitPhase, setGaitPhase] = useState('Resting Stance');

  // ── Operational Metrics ──────────────────────────────────────────────
  const [samplingRate, setSamplingRate] = useState(10.0);
  const [lastPacketTime, setLastPacketTime] = useState(null);
  const [timeAboveThresholdMs, setTimeAboveThresholdMs] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [events, setEvents] = useState([]);
  const [sessionStart, setSessionStart] = useState(() => Date.now());

  // ── UI Controls ──────────────────────────────────────────────────────
  const [isChartPaused, setIsChartPaused] = useState(false);
  const [soundAlert, setSoundAlert] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('connection');
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Notifications ────────────────────────────────────────────────────
  const [notificationConfig, setNotificationConfig] = useState(getStoredCaretakerConfig);

  // ── Refs ─────────────────────────────────────────────────────────────
  const activeEventsRef = useRef({});
  const breachStartRef = useRef({});
  const sensorLastEventTimeRef = useRef({});
  const lastPacketArrivalRef = useRef(null);
  const packetIntervalsRef = useRef([]);
  const lastNotificationRef = useRef(0);
  const lastTickTimeRef = useRef(0);
  const processRef = useRef(() => {});
  const notifConfigRef = useRef(null);
  const offlineNotifiedRef = useRef(false);

  useEffect(() => { notifConfigRef.current = notificationConfig; }, [notificationConfig]);

  // Fullscreen state tracking
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Global shortcut: Ctrl/Cmd + K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Normalisation ────────────────────────────────────────────────────
  const computeNormalized = useCallback((rawVal, offset = 0) => {
    const net = Math.max(0, (rawVal || 0) - offset);
    return Math.min(100, Math.round((net / adcResolution) * 100));
  }, [adcResolution]);

  // ── Core Telemetry Pipeline ──────────────────────────────────────────
  const processTelemetryPacket = useCallback((rawReadings, observedPhase = null, packetTimestamp = null) => {
    const now = packetTimestamp || Date.now();

    // 1. Sampling rate
    if (lastPacketArrivalRef.current) {
      const delta = now - lastPacketArrivalRef.current;
      if (delta > 20 && delta < 2000) {
        packetIntervalsRef.current.push(delta);
        if (packetIntervalsRef.current.length > 10) packetIntervalsRef.current.shift();
        const avg = packetIntervalsRef.current.reduce((a, b) => a + b, 0) / packetIntervalsRef.current.length;
        if (avg > 0) setSamplingRate(1000 / avg);
      }
    }
    lastPacketArrivalRef.current = now;
    offlineNotifiedRef.current = false;
    setLastPacketTime(now);
    setIsReceivingTelemetry(true);
    setIsStale(false);

    // 2. Normalised values
    const norm = {};
    SENSORS.forEach(({ id }) => { norm[id] = computeNormalized(rawReadings[id], tareOffsets[id]); });

    setRawSensorData(rawReadings);
    setSensorNorm(norm);

    // 3. Session peaks
    setPeakNorm((prev) => {
      const next = {};
      SENSORS.forEach(({ id }) => { next[id] = Math.max(prev[id], norm[id]); });
      return next;
    });

    // 4. History
    if (!isChartPaused) {
      setHistory((prev) => {
        const next = prev.length >= HISTORY_LIMIT ? prev.slice(prev.length - HISTORY_LIMIT + 1) : prev.slice();
        next.push({ timestamp: now, ...norm });
        return next;
      });
    }

    // 5. Gait phase
    let phase = observedPhase;
    if (!phase) {
      if (norm.heel > norm.greatToe && norm.heel > 35) phase = 'Heel Strike (Contact)';
      else if (norm.greatToe > 45 || norm.firstMetatarsal > 45) phase = 'Forefoot Push-Off';
      else if (norm.fifthMetatarsal > 25) phase = 'Midstance (Full Foot)';
      else phase = 'Swing Phase (Unloaded)';
    }
    setGaitPhase(phase);

    // 6. Cumulative over-threshold exposure
    const isAnyExceeding = Object.values(norm).some((v) => v >= thresholdNorm);
    const tickDelta = now - lastTickTimeRef.current;
    lastTickTimeRef.current = now;
    if (isAnyExceeding && tickDelta > 0 && tickDelta < 1000) setTimeAboveThresholdMs((t) => t + tickDelta);

    // 7. Threshold events (persistence, hysteresis, cooldown)
    const cooldownMs = (notificationConfig.cooldownMinutes || 5) * 60 * 1000;
    const SENSOR_EVENT_DEBOUNCE_MS = 2500;

    Object.entries(norm).forEach(([sensorKey, loadPct]) => {
      const isOver = loadPct >= thresholdNorm;
      const activeEvt = activeEventsRef.current[sensorKey];

      if (isOver) {
        if (!breachStartRef.current[sensorKey]) breachStartRef.current[sensorKey] = now;
        const breachDwellMs = now - breachStartRef.current[sensorKey];
        const lastEvtTime = sensorLastEventTimeRef.current[sensorKey] || 0;
        const cooldownPassed = (now - lastEvtTime) > SENSOR_EVENT_DEBOUNCE_MS;

        if (!activeEvt && breachDwellMs >= 120 && cooldownPassed) {
          const newEvent = {
            id: `${sensorKey}-${now}`,
            sensorId: sensorKey,
            location: SENSOR_BY_ID[sensorKey]?.name || sensorKey,
            peakLoad: loadPct,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            startTime: now,
            durationMs: breachDwellMs,
            status: 'Active',
          };
          activeEventsRef.current[sensorKey] = newEvent;
          sensorLastEventTimeRef.current[sensorKey] = now;
          setEvents((prev) => [newEvent, ...prev].slice(0, 200));
          setAlertCount((c) => c + 1);

          if (soundAlert) playWarningBeep(880, 0.12);

          if (notificationConfig.autoNotify && isTelegramReady(notificationConfig) && (now - lastNotificationRef.current > cooldownMs)) {
            lastNotificationRef.current = now;
            dispatchNotification({
              config: notificationConfig,
              locationName: SENSOR_BY_ID[sensorKey]?.name || sensorKey,
              normalizedLoad: loadPct,
              rawVal: rawReadings[sensorKey],
              thresholdNorm,
              gaitPhase: phase,
            })
              .then(() => toast.success('Alert sent to Telegram', { id: 'notif-toast' }))
              .catch((err) => toast.error(err.message, { id: 'notif-err' }));
          }
        } else if (activeEvt) {
          if (loadPct > activeEvt.peakLoad) activeEvt.peakLoad = loadPct;
          activeEvt.durationMs = now - activeEvt.startTime;
          setEvents((prev) => prev.map((e) => (e.id === activeEvt.id ? { ...e, peakLoad: activeEvt.peakLoad, durationMs: activeEvt.durationMs } : e)));
        }
      } else if (loadPct < thresholdNorm - 3) {
        breachStartRef.current[sensorKey] = null;
        if (activeEvt) {
          const durationMs = Math.max(150, now - activeEvt.startTime);
          setEvents((prev) => prev.map((e) => (e.id === activeEvt.id && e.status === 'Active' ? { ...e, status: 'Resolved', durationMs } : e)));
          delete activeEventsRef.current[sensorKey];
        }
      }
    });
  }, [computeNormalized, tareOffsets, isChartPaused, thresholdNorm, soundAlert, notificationConfig]);

  // Always-current pipeline reference, so data listeners never need to re-subscribe on UI changes
  useEffect(() => { processRef.current = processTelemetryPacket; }, [processTelemetryPacket]);

  // ── Resets ───────────────────────────────────────────────────────────
  const clearSessionState = useCallback(() => {
    setHistory([]);
    setPeakNorm({ ...EMPTY_READINGS });
    setTimeAboveThresholdMs(0);
    setAlertCount(0);
    setEvents([]);
    setSessionStart(Date.now());
    activeEventsRef.current = {};
    breachStartRef.current = {};
    sensorLastEventTimeRef.current = {};
  }, []);

  // ── Source Switching ─────────────────────────────────────────────────
  const handleSwitchSource = useCallback((newSource) => {
    if (newSource === dataSource) return;

    lastPacketArrivalRef.current = null;
    packetIntervalsRef.current = [];
    lastTickTimeRef.current = Date.now();

    clearSessionState();
    setRawSensorData({ ...EMPTY_READINGS });
    setSensorNorm({ ...EMPTY_READINGS });
    setSamplingRate(0);
    setLastPacketTime(null);
    setIsReceivingTelemetry(false);
    setIsStale(false);

    if (newSource === 'firebase') {
      setGaitPhase('Awaiting Telemetry');
      toast.success('Live mode · awaiting STM32 telemetry…', { id: 'source-toast' });
    } else {
      setGaitPhase('Resting Stance');
      toast.success('Simulation mode', { id: 'source-toast' });
    }
    setDataSource(newSource);
  }, [dataSource, clearSessionState]);

  // ── Firebase Realtime Listener ───────────────────────────────────────
  useEffect(() => {
    if (dataSource !== 'firebase' || !db) {
      setIsFirebaseConnected(false);
      setIsReceivingTelemetry(false);
      return undefined;
    }

    try {
      const sRef = ref(db, 'sensors');
      setIsFirebaseConnected(true);

      let snapshotCount = 0;
      let initialJson = null;

      const unsub = onValue(
        sRef,
        (snapshot) => {
          const d = snapshot.val();
          if (!d) {
            setIsReceivingTelemetry(false);
            return;
          }

          const getRaw = (siteKey, defaultPin) => Number(d[fsrMapping[siteKey] || defaultPin] ?? d[siteKey] ?? 0);
          const rawValues = {
            greatToe:        getRaw('greatToe', 'fsr1'),
            firstMetatarsal: getRaw('firstMetatarsal', 'fsr2'),
            fifthMetatarsal: getRaw('fifthMetatarsal', 'fsr3'),
            heel:            getRaw('heel', 'fsr4'),
          };

          const currentJson = JSON.stringify(d);
          const packetTs = d.timestamp || d.ts || d.time;
          const now = Date.now();
          snapshotCount++;

          // Distinguish a genuine live write from a static record already sitting in the database
          let isLivePacket = false;
          if (packetTs) {
            isLivePacket = (now - packetTs) <= 6000;
          } else if (snapshotCount === 1) {
            initialJson = currentJson;
          } else {
            isLivePacket = currentJson !== initialJson || snapshotCount > 1;
          }

          if (isLivePacket) processRef.current(rawValues, null, packetTs || now);
          else setIsReceivingTelemetry(false);
        },
        (err) => {
          setIsFirebaseConnected(false);
          setIsReceivingTelemetry(false);
          toast.error(`Firebase: ${err.message.slice(0, 50)}`);
        }
      );

      return () => unsub();
    } catch {
      setIsFirebaseConnected(false);
      setIsReceivingTelemetry(false);
      return undefined;
    }
  }, [dataSource, fsrMapping]);

  // ── Simulation Generator ─────────────────────────────────────────────
  useEffect(() => {
    if (dataSource !== 'simulator') return undefined;
    const interval = setInterval(() => {
      const step = generateSimulatedStep(simScenarioKey, (thresholdNorm * adcResolution) / 100, adcResolution);
      if (step) processRef.current(step.sensorData, step.phase);
    }, 100);
    return () => clearInterval(interval);
  }, [dataSource, simScenarioKey, thresholdNorm, adcResolution]);

  // ── Stale Telemetry Monitor (both sources) ───────────────────────────
  useEffect(() => {
    const monitor = setInterval(() => {
      if (lastPacketTime && Date.now() - lastPacketTime > STALE_TIMEOUT_MS) {
        setIsReceivingTelemetry(false);
        setIsStale(true);

        // Tell the caregiver once per outage that the insole stopped streaming (live mode only)
        const cfg = notifConfigRef.current;
        if (dataSource === 'firebase' && cfg?.notifyOffline && isTelegramReady(cfg) && !offlineNotifiedRef.current) {
          offlineNotifiedRef.current = true;
          dispatchOffline({ config: cfg, silentSeconds: Math.round((Date.now() - lastPacketTime) / 1000) })
            .then(() => toast('Offline notice sent to Telegram', { icon: '📨', id: 'offline-toast' }))
            .catch((err) => toast.error(err.message, { id: 'notif-err' }));
        }
      }
    }, 1000);
    return () => clearInterval(monitor);
  }, [lastPacketTime, dataSource]);

  // ── Actions ──────────────────────────────────────────────────────────
  const handleResetSession = useCallback(() => {
    clearSessionState();
    toast.success('Session reset');
  }, [clearSessionState]);

  const handleTare = useCallback(() => {
    setTareOffsets({ ...rawSensorData });
    toast.success('Sensors zeroed to current baseline');
  }, [rawSensorData]);

  const handleAcknowledgeEvent = useCallback((id) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status: 'Acknowledged' } : e)));
    toast.success('Event acknowledged');
  }, []);

  const handleAcknowledgeAll = useCallback(() => {
    setEvents((prev) => prev.map((e) => (e.status === 'Active' ? { ...e, status: 'Acknowledged' } : e)));
    toast.success('All active events acknowledged');
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!history.length) {
      toast('No telemetry data in the current buffer', { icon: 'ℹ️' });
      return;
    }
    const rows = history
      .map((h) => `${new Date(h.timestamp).toISOString()},${h.greatToe},${h.firstMetatarsal},${h.fifthMetatarsal},${h.heel}`)
      .join('\n');
    downloadFile(`gaitiq-telemetry-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`,
      `Timestamp,Hallux_Pct,MTH1_Pct,MTH5_Pct,Heel_Pct\n${rows}`);
    toast.success('Session telemetry exported');
  }, [history]);

  const handleExportEvents = useCallback(() => {
    if (!events.length) return;
    const rows = events
      .map((e) => `${e.timestamp},${e.location},${e.peakLoad},${(e.durationMs / 1000).toFixed(1)},${e.status}`)
      .join('\n');
    downloadFile(`gaitiq-events-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`,
      `Time,Site,Peak_Pct,Duration_s,Status\n${rows}`);
    toast.success('Event log exported');
  }, [events]);

  const handlePrint = useCallback(() => window.print(), []);

  const handleSendTestPacket = async () => {
    if (!db) throw new Error('Firebase instance not available');
    const scale = adcResolution === 4095 ? 4 : 1;
    await set(ref(db, 'sensors'), { fsr1: 620 * scale, fsr2: 480 * scale, fsr3: 310 * scale, fsr4: 790 * scale, timestamp: Date.now() });
  };

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => toast.error('Fullscreen is not available'));
  }, []);

  const openSettings = useCallback((tab) => { setSettingsTab(tab); setIsSettingsOpen(true); }, []);

  // ── Derived metrics ──────────────────────────────────────────────────
  const peakOverallNorm = Math.max(...Object.values(peakNorm));
  const peakSensorKey = SENSORS.reduce((best, s) => (peakNorm[s.id] > peakNorm[best] ? s.id : best), SENSORS[0].id);
  const peakSensorName = peakOverallNorm > 0 ? SENSOR_BY_ID[peakSensorKey].short : '—';

  const maxCurrent = Math.max(...Object.values(sensorNorm));
  const hottestKey = SENSORS.reduce((best, s) => (sensorNorm[s.id] > sensorNorm[best] ? s.id : best), SENSORS[0].id);

  const forefootLoad = sensorNorm.greatToe + sensorNorm.firstMetatarsal + sensorNorm.fifthMetatarsal;
  const totalLoad = forefootLoad + sensorNorm.heel;
  const forefootPct = totalLoad > 0 ? Math.round((forefootLoad / totalLoad) * 100) : 50;

  const status = !isReceivingTelemetry ? 'idle'
    : maxCurrent >= thresholdNorm ? 'danger'
    : maxCurrent >= thresholdNorm * 0.8 ? 'warn'
    : 'ok';

  const handleSendSummary = useCallback(async () => {
    if (!isTelegramReady(notificationConfig)) {
      toast('Set up Telegram first', { icon: 'ℹ️' });
      openSettings('alerts');
      return;
    }
    try {
      await dispatchSummary({
        config: notificationConfig,
        durationLabel: formatClock((Date.now() - sessionStart) / 1000),
        peakPct: peakOverallNorm,
        peakSite: peakSensorName,
        secondsOver: (timeAboveThresholdMs / 1000).toFixed(1),
        alertCount,
        forefootPct,
        thresholdNorm,
      });
      toast.success('Session summary sent to Telegram');
    } catch (err) {
      toast.error(err.message);
    }
  }, [notificationConfig, sessionStart, peakOverallNorm, peakSensorName, timeAboveThresholdMs, alertCount, forefootPct, thresholdNorm, openSettings]);

  const telegramReady = isTelegramReady(notificationConfig);

  // ── Command palette actions ──────────────────────────────────────────
  const commands = useMemo(() => [
    { id: 'src-live', group: 'Data source', label: 'Switch to Live (STM32)', icon: Radio, hint: dataSource === 'firebase' ? 'Active' : '', keywords: 'firebase device', run: () => handleSwitchSource('firebase') },
    { id: 'src-sim', group: 'Data source', label: 'Switch to Simulation', icon: FlaskConical, hint: dataSource === 'simulator' ? 'Active' : '', keywords: 'synthetic demo', run: () => handleSwitchSource('simulator') },
    ...Object.values(SIMULATION_SCENARIOS).map((s) => ({
      id: `scn-${s.id}`, group: 'Simulation scenario', label: s.label, icon: FlaskConical, hint: simScenarioKey === s.id ? 'Selected' : '', keywords: 'scenario pattern test',
      run: () => { if (dataSource !== 'simulator') handleSwitchSource('simulator'); setSimScenarioKey(s.id); },
    })),
    { id: 'tare', group: 'Device', label: 'Tare sensors (zero baseline)', icon: RefreshCw, keywords: 'calibrate zero', run: handleTare },
    { id: 'diag', group: 'Device', label: showDiagnostics ? 'Hide raw ADC diagnostics' : 'Show raw ADC diagnostics', icon: Sliders, keywords: 'adc raw', run: () => setShowDiagnostics((d) => !d) },
    { id: 'pause', group: 'Telemetry', label: isChartPaused ? 'Resume recording' : 'Pause recording', icon: isChartPaused ? Play : Pause, keywords: 'chart stream', run: () => setIsChartPaused((p) => !p) },
    { id: 'sound', group: 'Telemetry', label: soundAlert ? 'Mute audible alerts' : 'Enable audible alerts', icon: soundAlert ? VolumeX : Volume2, keywords: 'beep audio', run: () => setSoundAlert((s) => !s) },
    { id: 'ack', group: 'Telemetry', label: 'Acknowledge all active events', icon: CheckCheck, keywords: 'alerts', run: handleAcknowledgeAll },
    { id: 'reset', group: 'Telemetry', label: 'Reset session', icon: RotateCcw, keywords: 'clear', run: handleResetSession },
    { id: 'csv', group: 'Export', label: 'Export telemetry CSV', icon: Download, run: handleExportCSV },
    { id: 'csv-ev', group: 'Export', label: 'Export event log CSV', icon: Download, run: handleExportEvents },
    { id: 'print', group: 'Export', label: 'Print / save session report', icon: Printer, keywords: 'pdf', run: handlePrint },
    { id: 'theme', group: 'Interface', label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', icon: Palette, keywords: 'dark light appearance', run: toggleTheme },
    { id: 'fs', group: 'Interface', label: isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen', icon: Maximize2, run: toggleFullscreen },
    { id: 'set-conn', group: 'Settings', label: 'Open connection settings', icon: Settings, run: () => openSettings('connection') },
    { id: 'set-map', group: 'Settings', label: 'Open sensor mapping', icon: Sliders, run: () => openSettings('mapping') },
    { id: 'tg-summary', group: 'Telegram', label: 'Send session summary to Telegram', icon: Send, keywords: 'share notify message', run: handleSendSummary },
    { id: 'set-alert', group: 'Telegram', label: 'Open Telegram setup', icon: Send, keywords: 'bot alerts notifications chat', run: () => openSettings('alerts') },
  ], [dataSource, simScenarioKey, showDiagnostics, isChartPaused, soundAlert, theme, isFullscreen,
    handleSwitchSource, handleTare, handleAcknowledgeAll, handleResetSession, handleExportCSV, handleExportEvents,
    handlePrint, toggleTheme, toggleFullscreen, openSettings, handleSendSummary]);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--surface)', color: 'var(--t1)', border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)', fontSize: '13px', fontFamily: 'Figtree, system-ui, sans-serif',
            borderRadius: '10px', padding: '10px 14px',
          },
        }}
      />

      {/* ═══ Top bar ═══ */}
      <header className="topbar no-print">
        <div className="topbar-inner">
          <div className="brand">
            <Logo size={36} />
            <div>
              <div className="brand-name">Gait<span className="iq">IQ</span></div>
              <div className="brand-sub">Smart insole</div>
            </div>
          </div>

          <div className="topbar-spacer" />

          <div className="topbar-group topbar-source">
            <div className="seg" role="group" aria-label="Data source">
              <button id="btn-live" type="button" aria-pressed={dataSource === 'firebase'} onClick={() => handleSwitchSource('firebase')}>
                <span className={`dot ${dataSource === 'firebase' && isReceivingTelemetry ? 'dot-ok dot-live' : ''}`} style={{ width: 7, height: 7 }} />Live
              </button>
              <button id="btn-sim" type="button" aria-pressed={dataSource === 'simulator'} onClick={() => handleSwitchSource('simulator')}>Simulation</button>
            </div>

            {dataSource === 'simulator' && (
              <select id="select-scenario" className="inp inp-sm" value={simScenarioKey} onChange={(e) => setSimScenarioKey(e.target.value)} title="Simulation test pattern" aria-label="Simulation scenario">
                {Object.values(SIMULATION_SCENARIOS).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            )}
          </div>

          <div className="topbar-group topbar-actions">
            <button type="button" className="cmd-trigger" onClick={() => setIsPaletteOpen(true)} aria-label="Open command palette">
              <Search size={15} /><span className="cmd-label">Search or run command…</span><span className="kbd">{isMac ? '⌘' : 'Ctrl'} K</span>
            </button>
            <button type="button" className="btn btn-icon" onClick={toggleTheme} title={theme === 'dark' ? 'Light theme' : 'Dark theme'} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button type="button" className="btn btn-icon hide-sm" onClick={toggleFullscreen} title="Toggle fullscreen" aria-label="Toggle fullscreen">
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button id="btn-alerts" type="button" className="btn btn-icon" onClick={() => openSettings('alerts')}
              title={telegramReady ? (notificationConfig.autoNotify ? 'Telegram alerts are on' : 'Telegram connected · alerts off') : 'Set up Telegram alerts'} aria-label="Telegram alert settings"
              style={{ color: telegramReady && notificationConfig.autoNotify ? 'var(--primary)' : undefined }}>
              <Send size={16} />{telegramReady && notificationConfig.autoNotify && <span className="badge-dot" />}
            </button>
            <button id="btn-settings" type="button" className="btn btn-icon" onClick={() => openSettings('connection')} title="Settings" aria-label="Settings">
              <Settings size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Content ═══ */}
      <main className="container">
        <StatusHero
          status={status}
          maxLoad={maxCurrent}
          hottestName={SENSOR_BY_ID[hottestKey].short}
          thresholdNorm={thresholdNorm}
          gaitPhase={gaitPhase}
          sessionStart={sessionStart}
          forefootPct={forefootPct}
          dataSource={dataSource}
        />

        <DeviceHealth
          dataSource={dataSource}
          isFirebaseConnected={isFirebaseConnected}
          isReceiving={isReceivingTelemetry}
          samplingRate={samplingRate}
          lastPacketTime={lastPacketTime}
          isCalibrated={SENSORS.every((s) => tareOffsets[s.id] === 0)}
          onRecalibrate={handleTare}
          showDiagnostics={showDiagnostics}
          onToggleDiagnostics={() => setShowDiagnostics((d) => !d)}
          staleTimeoutSec={STALE_TIMEOUT_MS / 1000}
        />

        <PressureCards
          sensorNorm={sensorNorm}
          peakNorm={peakNorm}
          rawSensorData={rawSensorData}
          history={history}
          thresholdNorm={thresholdNorm}
          showDiagnostics={showDiagnostics}
          selectedSensor={selectedSensor}
          onSelectSensor={(id) => setSelectedSensor((prev) => (prev === id ? null : id))}
        />

        <div className="grid-main">
          <FootHeatmap
            sensorNorm={sensorNorm}
            peakNorm={peakNorm}
            thresholdNorm={thresholdNorm}
            selectedSensor={selectedSensor}
            onSelectSensor={(id) => setSelectedSensor((prev) => (prev === id ? null : id))}
          />
          <AmbulatoryChart
            history={history}
            thresholdNorm={thresholdNorm}
            isPaused={isChartPaused}
            onTogglePause={() => setIsChartPaused((p) => !p)}
            onClearHistory={handleResetSession}
            dataSource={dataSource}
            isStale={dataSource === 'firebase' && isStale}
            onSwitchToSimulation={() => handleSwitchSource('simulator')}
          />
        </div>

        <div className="grid-bottom">
          <SessionSummary
            peakOverallNorm={peakOverallNorm}
            peakSensorName={peakSensorName}
            timeAboveThresholdMs={timeAboveThresholdMs}
            alertCount={alertCount}
            forefootPct={forefootPct}
            thresholdNorm={thresholdNorm}
            onThresholdChange={setThresholdNorm}
            soundAlert={soundAlert}
            onToggleSound={() => setSoundAlert((s) => !s)}
            onExportCSV={handleExportCSV}
            onPrint={handlePrint}
            onSendSummary={handleSendSummary}
            telegramReady={telegramReady}
          />
          <EventLog
            events={events}
            onAcknowledge={handleAcknowledgeEvent}
            onAcknowledgeAll={handleAcknowledgeAll}
            onClear={() => setEvents([])}
            onExport={handleExportEvents}
          />
        </div>

        <footer className="footer">
          <span>GaitIQ · research prototype · STM32 Blue Pill telemetry</span>
          <span>4-channel plantar contact array (PA0–PA3)</span>
        </footer>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsTab}
        mapping={fsrMapping}
        onUpdateMapping={setFsrMapping}
        adcResolution={adcResolution}
        onUpdateAdcResolution={setAdcResolution}
        notificationConfig={notificationConfig}
        onUpdateNotificationConfig={(cfg) => { setNotificationConfig(cfg); saveCaretakerConfig(cfg); }}
        onSendTestPacket={handleSendTestPacket}
        onResetSession={handleResetSession}
        onTare={handleTare}
        onExportCSV={handleExportCSV}
        thresholdNorm={thresholdNorm}
      />

      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} commands={commands} />
    </>
  );
}
