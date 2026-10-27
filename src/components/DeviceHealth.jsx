import React, { useState, useEffect } from 'react';
import { Clock, Activity, CircleCheck, CircleDot, RefreshCw, Sliders } from 'lucide-react';

export default function DeviceHealth({
  dataSource,
  isFirebaseConnected,
  isReceiving = false,
  samplingRate = 0,
  lastPacketTime,
  isCalibrated = true,
  onRecalibrate,
  showDiagnostics,
  onToggleDiagnostics,
  staleTimeoutSec = 5,
}) {
  const [elapsedSec, setElapsedSec] = useState(null);

  useEffect(() => {
    const tick = () => setElapsedSec(lastPacketTime ? Math.max(0, Math.round((Date.now() - lastPacketTime) / 1000)) : null);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [lastPacketTime]);

  const isLive = dataSource === 'firebase';
  const isStale = elapsedSec !== null && elapsedSec > staleTimeoutSec;
  const healthy = isReceiving && !isStale && (!isLive || isFirebaseConnected);

  const label = isLive
    ? healthy ? 'Live · STM32 Blue Pill connected'
      : elapsedSec === null ? 'Awaiting device data' : 'Telemetry stream inactive'
    : healthy ? 'Simulation running' : 'Simulation stream halted';

  return (
    <div className="card strip animate-in delay-1">
      <div className="strip-status">
        <span className={`dot ${healthy ? 'dot-ok dot-live' : 'dot-warn'}`} />
        <strong style={{ fontSize: 13.5, fontWeight: 650 }}>{label}</strong>
        {isLive && !healthy && elapsedSec !== null && <span className="pill pill-warn">{elapsedSec}s silent</span>}
      </div>

      <div className="strip-actions">
        {healthy && samplingRate > 0 && (
          <span className="strip-metric"><Activity size={14} />Rate <strong className="num">{samplingRate.toFixed(1)} Hz</strong></span>
        )}
        {elapsedSec !== null && (
          <span className="strip-metric hide-sm">
            <Clock size={14} />Last packet <strong className="num" style={{ color: isStale ? 'var(--warn)' : undefined }}>{elapsedSec === 0 ? 'just now' : `${elapsedSec}s ago`}</strong>
          </span>
        )}
        <span className="strip-metric">
          {isCalibrated ? <CircleCheck size={14} color="var(--ok)" /> : <CircleDot size={14} color="var(--warn)" />}
          {isCalibrated ? 'Calibrated' : 'Zero offset applied'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {onRecalibrate && (
            <button id="btn-tare" type="button" className="btn btn-sm" onClick={onRecalibrate} title="Zero all sensors to the current baseline">
              <RefreshCw size={13} />Tare
            </button>
          )}
          {onToggleDiagnostics && (
            <button id="btn-diagnostics" type="button" className={`btn btn-sm ${showDiagnostics ? 'btn-active' : ''}`} onClick={onToggleDiagnostics} title="Show raw ADC values">
              <Sliders size={13} />Diagnostics
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
