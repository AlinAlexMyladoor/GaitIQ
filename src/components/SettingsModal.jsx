import React, { useEffect, useState } from 'react';
import { X, Radio, SlidersHorizontal, Send, RotateCcw, CircleCheck, CircleAlert, Download, ExternalLink, Search, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { getFirebaseConnectionInfo } from '../firebase';
import { verifyBotToken, detectChat, sendTestMessage, isTelegramReady } from '../utils/caretakerNotifier';

const TABS = [
  { id: 'connection', label: 'Connection',    icon: Radio },
  { id: 'mapping',    label: 'Sensors',       icon: SlidersHorizontal },
  { id: 'alerts',     label: 'Telegram',      icon: Send },
  { id: 'session',    label: 'Session',       icon: RotateCcw },
];

const FSR_OPTIONS = [
  { value: 'fsr1', label: 'fsr1 · Pin PA0 (ADC1_IN0)' },
  { value: 'fsr2', label: 'fsr2 · Pin PA1 (ADC1_IN1)' },
  { value: 'fsr3', label: 'fsr3 · Pin PA2 (ADC1_IN2)' },
  { value: 'fsr4', label: 'fsr4 · Pin PA3 (ADC1_IN3)' },
];

const MAPPING_FIELDS = [
  { key: 'greatToe', label: 'Great Toe (Hallux)' },
  { key: 'firstMetatarsal', label: '1st Metatarsal (MTH1)' },
  { key: 'fifthMetatarsal', label: '5th Metatarsal (MTH5)' },
  { key: 'heel', label: 'Heel (Calcaneus)' },
];

const localNotif0 = (cfg) => !!(cfg && cfg.telegramBotToken && cfg.botUsername);

// Outer wrapper keeps hooks out of the conditional return (Rules of Hooks).
export default function SettingsModal(props) {
  if (!props.isOpen) return null;
  return <SettingsDialog {...props} />;
}

function SettingsDialog({
  onClose, initialTab = 'connection', mapping, onUpdateMapping, adcResolution, onUpdateAdcResolution,
  notificationConfig, onUpdateNotificationConfig, onSendTestPacket, onResetSession, onTare, onExportCSV, thresholdNorm,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [localMapping, setLocalMapping] = useState(mapping);
  const [localNotif, setLocalNotif] = useState(notificationConfig);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [tokenCheck, setTokenCheck] = useState({ state: localNotif0(notificationConfig) ? 'ok' : 'idle', text: localNotif0(notificationConfig) ? `Connected to @${notificationConfig.botUsername}` : '' });
  const [chatCheck, setChatCheck] = useState({ state: notificationConfig.telegramChatId ? 'ok' : 'idle', text: notificationConfig.telegramChatId ? 'Chat ID saved' : '' });
  const [testCheck, setTestCheck] = useState({ state: 'idle', text: '' });

  const fbInfo = getFirebaseConnectionInfo();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = (e) => {
    e.preventDefault();
    onUpdateMapping(localMapping);
    try { localStorage.setItem('smart_insole_fsr_mapping', JSON.stringify(localMapping)); } catch { /* ignore */ }
    onUpdateNotificationConfig(localNotif);
    toast.success('Configuration saved');
    onClose();
  };

  const handleTestWrite = async () => {
    if (!onSendTestPacket) return;
    setIsTestingConnection(true);
    try {
      await onSendTestPacket();
      toast.success('Diagnostic packet written to /sensors');
    } catch (err) {
      toast.error(`Write test failed: ${err.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleVerify = async () => {
    setTokenCheck({ state: 'loading', text: 'Checking token…' });
    try {
      const bot = await verifyBotToken(localNotif.telegramBotToken);
      setN({ botUsername: bot.username });
      setTokenCheck({ state: 'ok', text: `Connected to @${bot.username}` });
    } catch (err) {
      setN({ botUsername: '' });
      setTokenCheck({ state: 'err', text: err.message });
    }
  };

  const handleDetect = async () => {
    setChatCheck({ state: 'loading', text: 'Looking for your chat…' });
    try {
      const { chatId, label } = await detectChat(localNotif.telegramBotToken);
      setN({ telegramChatId: chatId });
      setChatCheck({ state: 'ok', text: `Found chat with ${label}` });
    } catch (err) {
      setChatCheck({ state: 'err', text: err.message });
    }
  };

  const handleTestNotification = async () => {
    setTestCheck({ state: 'loading', text: 'Sending…' });
    try {
      await sendTestMessage(localNotif);
      setTestCheck({ state: 'ok', text: 'Test message delivered. Check Telegram.' });
      toast.success('Test message sent to Telegram');
    } catch (err) {
      setTestCheck({ state: 'err', text: err.message });
    }
  };

  const setN = (patch) => setLocalNotif((n) => ({ ...n, ...patch }));

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Configuration and settings">
        <div className="modal-head">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.025em' }}>Settings</h2>
            <p className="card-sub">Hardware channels, telemetry pipeline and caretaker rules</p>
          </div>
          <button id="btn-settings-close" type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close settings"><X size={16} /></button>
        </div>

        <div className="tabs" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} id={`tab-${id}`} type="button" role="tab" className="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="modal-body" style={{ paddingTop: 20 }}>
            {activeTab === 'connection' && (
              <>
                <div className={`callout ${fbInfo.isConfigured ? 'callout-ok' : 'callout-warn'}`}>
                  {fbInfo.isConfigured ? <CircleCheck size={17} /> : <CircleAlert size={17} />}
                  {fbInfo.isConfigured ? 'Firebase Realtime Database is configured' : 'Database URL is not configured in the environment'}
                </div>
                <div>
                  <div className="group-title">Endpoint</div>
                  <div className="kv"><span>Database path</span><span className="mono" style={{ color: 'var(--primary)' }}>/sensors</span></div>
                  <div className="kv"><span>Project</span><span className="mono">{fbInfo.projectId}</span></div>
                  <div className="kv"><span>Payload</span><span className="mono">{'{ fsr1…fsr4, timestamp }'}</span></div>
                  <div className="kv"><span>Config source</span><span className="mono" style={{ color: 'var(--t3)' }}>.env · VITE_FIREBASE_*</span></div>
                </div>
                <button type="button" className="btn" disabled={isTestingConnection || !fbInfo.isConfigured} onClick={handleTestWrite}>
                  <Send size={14} />{isTestingConnection ? 'Writing test sample…' : 'Send diagnostic sample to /sensors'}
                </button>
              </>
            )}

            {activeTab === 'mapping' && (
              <>
                <div>
                  <div className="group-title">STM32 Blue Pill ADC channel mapping</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    {MAPPING_FIELDS.map((f) => (
                      <div className="field" key={f.key}>
                        <label className="label" htmlFor={`map-${f.key}`}>{f.label}</label>
                        <select id={`map-${f.key}`} className="inp mono" style={{ fontSize: 12 }} value={localMapping[f.key]} onChange={(e) => setLocalMapping((m) => ({ ...m, [f.key]: e.target.value }))}>
                          {FSR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="setting-row" style={{ borderTop: '1px solid var(--border-soft)', borderBottom: '1px solid var(--border-soft)' }}>
                  <div><div className="setting-title">Baseline tare calibration</div><div className="setting-desc">Zero the unloaded insole pre-load</div></div>
                  <button type="button" className="btn btn-sm" onClick={() => onTare && onTare()}>Zero baseline</button>
                </div>
                <details className="adv">
                  <summary>Advanced hardware settings</summary>
                  <div className="adv-body field">
                    <label className="label" htmlFor="adc-res">ADC resolution</label>
                    <select id="adc-res" className="inp mono" style={{ fontSize: 12 }} value={adcResolution} onChange={(e) => onUpdateAdcResolution && onUpdateAdcResolution(Number(e.target.value))}>
                      <option value={4095}>12-bit (0–4095) · native STM32 SAR ADC</option>
                      <option value={1023}>10-bit (0–1023) · pre-scaled ADC</option>
                    </select>
                  </div>
                </details>
              </>
            )}

            {activeTab === 'alerts' && (
              <>
                {(() => {
                  const ready = isTelegramReady(localNotif);
                  const noteIcon = (c) => (c.state === 'ok' ? <CircleCheck size={14} /> : c.state === 'err' ? <CircleAlert size={14} /> : <Loader size={14} className="spin" />);
                  return (
                    <>
                      <div className={`tg-status ${ready ? 'is-ready' : ''}`}>
                        <span className="tg-badge"><Send size={17} /></span>
                        <div style={{ minWidth: 0 }}>
                          <div className="tg-status-title">{ready ? 'Telegram is connected' : 'Telegram is not set up yet'}</div>
                          <div className="tg-status-sub">
                            {ready
                              ? <>Alerts go to {localNotif.botUsername ? <span className="mono">@{localNotif.botUsername}</span> : 'your bot'} · chat <span className="mono">{localNotif.telegramChatId}</span></>
                              : 'Free, instant and automatic. Setup takes about a minute.'}
                          </div>
                        </div>
                      </div>

                      <div className="steps">
                        <div className={`step ${localNotif.botUsername ? 'is-done' : ''}`}>
                          <span className="step-num">{localNotif.botUsername ? <CircleCheck size={15} /> : 1}</span>
                          <div>
                            <div className="step-title">Create your bot</div>
                            <p className="step-desc">
                              Open <a className="link" href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">@BotFather</a> in Telegram, send <span className="mono">/newbot</span>, follow the prompts, then paste the token it gives you.
                            </p>
                            <div className="step-row">
                              <input id="notif-token" type="password" autoComplete="off" spellCheck={false} className="inp mono" style={{ fontSize: 12 }} placeholder="123456789:AA…" aria-label="Telegram bot token"
                                value={localNotif.telegramBotToken || ''}
                                onChange={(e) => { setN({ telegramBotToken: e.target.value, botUsername: '' }); setTokenCheck({ state: 'idle', text: '' }); }} />
                              <button type="button" className="btn" disabled={!localNotif.telegramBotToken || tokenCheck.state === 'loading'} onClick={handleVerify}>Verify</button>
                            </div>
                            {tokenCheck.text && <div className={`step-note ${tokenCheck.state === 'ok' ? 'ok' : tokenCheck.state === 'err' ? 'err' : ''}`}>{noteIcon(tokenCheck)}{tokenCheck.text}</div>}
                          </div>
                        </div>

                        <div className={`step ${localNotif.telegramChatId ? 'is-done' : ''}`}>
                          <span className="step-num">{localNotif.telegramChatId ? <CircleCheck size={15} /> : 2}</span>
                          <div>
                            <div className="step-title">Connect your chat</div>
                            <p className="step-desc">
                              {localNotif.botUsername
                                ? <>Open <a className="link" href={`https://t.me/${localNotif.botUsername}`} target="_blank" rel="noopener noreferrer">@{localNotif.botUsername}<ExternalLink size={11} style={{ marginLeft: 4, verticalAlign: '-1px' }} /></a> and press <b>Start</b>, then tap Detect. To alert a group, add the bot to it and send a message there.</>
                                : 'Verify the token first, then press Start on your bot and tap Detect.'}
                            </p>
                            <div className="step-row">
                              <input id="notif-chat" type="text" inputMode="numeric" className="inp mono" placeholder="Chat ID" aria-label="Telegram chat ID"
                                value={localNotif.telegramChatId || ''}
                                onChange={(e) => { setN({ telegramChatId: e.target.value }); setChatCheck({ state: 'idle', text: '' }); }} />
                              <button type="button" className="btn" disabled={!localNotif.telegramBotToken || chatCheck.state === 'loading'} onClick={handleDetect}><Search size={14} />Detect</button>
                            </div>
                            {chatCheck.text && <div className={`step-note ${chatCheck.state === 'ok' ? 'ok' : chatCheck.state === 'err' ? 'err' : ''}`}>{noteIcon(chatCheck)}{chatCheck.text}</div>}
                          </div>
                        </div>

                        <div className={`step ${testCheck.state === 'ok' ? 'is-done' : ''}`}>
                          <span className="step-num">{testCheck.state === 'ok' ? <CircleCheck size={15} /> : 3}</span>
                          <div>
                            <div className="step-title">Send a test</div>
                            <p className="step-desc">Confirm the alert reaches your phone before you rely on it.</p>
                            <button type="button" className="btn btn-soft" disabled={!ready || testCheck.state === 'loading'} onClick={handleTestNotification}>
                              <Send size={14} />{testCheck.state === 'loading' ? 'Sending…' : 'Send test message'}
                            </button>
                            {testCheck.text && <div className={`step-note ${testCheck.state === 'ok' ? 'ok' : testCheck.state === 'err' ? 'err' : ''}`}>{noteIcon(testCheck)}{testCheck.text}</div>}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}

                <hr className="divider" />

                <div>
                  <div className="group-title">Alert rules</div>
                  <div className="setting-row" style={{ paddingTop: 0 }}>
                    <div><div className="setting-title">Pressure alerts</div><div className="setting-desc">Message me when a site stays over the threshold</div></div>
                    <input id="toggle-auto-notify" type="checkbox" className="switch" checked={!!localNotif.autoNotify} onChange={(e) => setN({ autoNotify: e.target.checked })} aria-label="Send pressure alerts to Telegram" />
                  </div>
                  <div className="setting-row">
                    <div><div className="setting-title">Insole offline</div><div className="setting-desc">Message me if live data stops arriving</div></div>
                    <input id="toggle-offline-notify" type="checkbox" className="switch" checked={!!localNotif.notifyOffline} onChange={(e) => setN({ notifyOffline: e.target.checked })} aria-label="Send offline alerts to Telegram" />
                  </div>
                  <div className="setting-row" style={{ alignItems: 'flex-end' }}>
                    <div className="field" style={{ flex: 1 }}>
                      <label className="label" htmlFor="notif-cooldown">Minimum gap between alerts</label>
                      <select id="notif-cooldown" className="inp" value={localNotif.cooldownMinutes} onChange={(e) => setN({ cooldownMinutes: Number(e.target.value) })}>
                        <option value={1}>1 minute</option>
                        <option value={5}>5 minutes</option>
                        <option value={15}>15 minutes</option>
                      </select>
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label className="label" htmlFor="notif-name">Name in messages <span style={{ color: 'var(--t3)', fontWeight: 500 }}>(optional)</span></label>
                      <input id="notif-name" type="text" className="inp" placeholder="e.g. Amma" value={localNotif.recipientName || ''} onChange={(e) => setN({ recipientName: e.target.value })} />
                    </div>
                  </div>
                  {!localNotif.autoNotify && isTelegramReady(localNotif) && (
                    <div className="callout callout-warn" style={{ marginTop: 10 }}><CircleAlert size={16} />Pressure alerts are switched off, so Telegram will stay quiet.</div>
                  )}
                </div>

                <div className="msg-preview" aria-label="Example alert message">
                  🔴 <b>GaitIQ · Pressure alert</b><br />
                  <b>Site</b> 1st Metatarsal &nbsp;·&nbsp; <b>Load</b> 88% (limit {thresholdNorm}%)<br />
                  <b>Phase</b> Forefoot push-off
                </div>

                <p className="hint">The bot token stays in this browser and is only sent to Telegram. Research prototype: not a medical alarm.</p>
              </>
            )}

            {activeTab === 'session' && (
              <div>
                <div className="setting-row" style={{ paddingTop: 0 }}>
                  <div><div className="setting-title">Reset session telemetry</div><div className="setting-desc">Clear waveforms, peaks and event log</div></div>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => { if (window.confirm('Reset all session data, peaks, and event logs?')) { onResetSession(); onClose(); } }}>
                    <RotateCcw size={13} />Reset data
                  </button>
                </div>
                {onExportCSV && (
                  <div className="setting-row">
                    <div><div className="setting-title">Export session buffer</div><div className="setting-desc">Download time-series data as CSV</div></div>
                    <button type="button" className="btn btn-sm" onClick={() => onExportCSV()}><Download size={13} />Export CSV</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-foot">
            <button id="btn-settings-cancel" type="button" className="btn" onClick={onClose}>Cancel</button>
            <button id="btn-settings-save" type="submit" className="btn btn-primary">Save changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
