// Caregiver alerts via Telegram.
//
// Telegram is the single supported channel: it is free, delivers instantly to a phone,
// and can be sent automatically (WhatsApp links need a manual tap and webhooks need a server).
//
// GaitIQ is a research prototype, not a certified diagnostic or emergency system.
// The bot token is kept in this browser's localStorage and is only ever sent to api.telegram.org.
// For a public deployment, route messages through a small backend/proxy instead.

const STORAGE_KEY = 'gaitiq_notification_config';
const API = 'https://api.telegram.org';

export const DEFAULT_CONFIG = {
  recipientName: '',
  telegramBotToken: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_BOT_TOKEN) || '',
  telegramChatId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_CHAT_ID) || '',
  telegramApiBaseUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_API_BASE) || '',
  botUsername: '',        // filled in after the token is verified
  autoNotify: true,       // send a message automatically when a site goes over the threshold
  notifyOffline: true,    // also send a message when the insole stops streaming
  cooldownMinutes: 0.5,   // 30 seconds default for real-time up-to-date alerts
};

/** Reads the saved config; older saves (WhatsApp / webhook era) are upgraded transparently. */
export const getStoredCaretakerConfig = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const envToken = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_BOT_TOKEN) || '';
    const envChatId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_CHAT_ID) || '';
    const envApiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_API_BASE) || '';

    if (saved && typeof saved === 'object') {
      return {
        ...DEFAULT_CONFIG,
        recipientName: saved.recipientName && saved.recipientName !== 'Caregiver / Researcher' ? saved.recipientName : '',
        telegramBotToken: saved.telegramBotToken || envToken,
        telegramChatId: saved.telegramChatId || envChatId,
        telegramApiBaseUrl: saved.telegramApiBaseUrl || envApiBase,
        botUsername: saved.botUsername || '',
        autoNotify: saved.autoNotify !== false,
        notifyOffline: saved.notifyOffline !== false,
        cooldownMinutes: Number(saved.cooldownMinutes) > 0 ? Number(saved.cooldownMinutes) : DEFAULT_CONFIG.cooldownMinutes,
      };
    }
  } catch (e) {
    console.warn('Could not read notification configuration:', e);
  }
  return { ...DEFAULT_CONFIG };
};

export const saveCaretakerConfig = (config) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Could not save notification configuration:', e);
  }
};

export const isTelegramReady = (config) => !!(config?.telegramBotToken && config?.telegramChatId);

// ── Low-level API call ─────────────────────────────────────────────────
const callTelegram = async (token, method, body, customBaseUrl) => {
  if (!token || !token.trim()) throw new Error('Enter your bot token first.');
  const base = (customBaseUrl && customBaseUrl.trim()) ? customBaseUrl.trim().replace(/\/+$/, '') : API;
  let res;
  try {
    res = await fetch(`${base}/bot${token.trim()}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  } catch (err) {
    throw new Error('Connection to Telegram was reset by your ISP/network. Turn on 1.1.1.1 (Cloudflare WARP) or VPN, or use a Telegram proxy.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  if (!data?.ok) {
    if (res.status === 401 || res.status === 404) throw new Error('Telegram rejected this bot token. Copy it again from @BotFather.');
    throw new Error(data?.description || `Telegram error (HTTP ${res.status})`);
  }
  return data.result;
};

/** Confirms the token is valid and returns the bot's public identity. */
export const verifyBotToken = async (token, customBaseUrl) => {
  const me = await callTelegram(token, 'getMe', null, customBaseUrl);
  return { username: me.username, name: me.first_name };
};

/**
 * Finds the chat that most recently messaged the bot (the user presses "Start" first).
 * Returns { chatId, label } or throws a helpful error.
 */
export const detectChat = async (token, customBaseUrl) => {
  const updates = await callTelegram(token, 'getUpdates', { limit: 25, allowed_updates: ['message', 'my_chat_member'] }, customBaseUrl);
  const chats = updates
    .map((u) => u.message?.chat || u.my_chat_member?.chat)
    .filter(Boolean);
  if (!chats.length) {
    throw new Error('No chat found yet. Open your bot in Telegram, press Start (or send "hi"), then try again.');
  }
  const chat = chats[chats.length - 1];
  const label = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || 'your chat';
  return { chatId: String(chat.id), label };
};

// ── Message formatting (Telegram HTML mode) ────────────────────────────
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clock = () => new Date().toLocaleTimeString('en-GB', { hour12: false });

const withRecipient = (config, lines) => (config.recipientName ? [`<i>For ${esc(config.recipientName)}</i>`, ...lines] : lines);

export const formatOverloadMessage = (config, { locationName, normalizedLoad, thresholdNorm, gaitPhase, rawVal }) => {
  const isCritical = Number(normalizedLoad) >= 90;
  const emoji = isCritical ? '🚨' : '🔴';
  const header = isCritical ? 'CRITICAL PRESSURE SPIKE' : 'High Pressure Alert';

  return withRecipient(config, [
    `${emoji} <b>GaitIQ · ${header}</b>`,
    '',
    `<b>Sensor Site:</b>  ${esc(locationName)}`,
    `<b>Measured Load:</b> <b>${esc(normalizedLoad)}%</b> (Limit: ${esc(thresholdNorm)}%)`,
    `<b>Gait Phase:</b>    ${esc(gaitPhase || 'Dynamic Stance')}`,
    rawVal != null ? `<b>Raw ADC:</b>       ${esc(Math.round(Number(rawVal)))}` : null,
    `<b>Time:</b>          ${clock()}`,
    '',
    isCritical
      ? '⚠️ <i>Immediate pressure offloading advised to avoid tissue damage.</i>'
      : '<i>Please check insole fit and wearer pressure distribution.</i>',
  ].filter((l) => l !== null)).join('\n');
};

export const formatOfflineMessage = (config, { silentSeconds }) =>
  withRecipient(config, [
    '🟠 <b>GaitIQ · Insole offline</b>',
    '',
    `No data received for ${esc(silentSeconds)} s. Check the insole battery and Wi-Fi.`,
    `<b>Time</b>   ${clock()}`,
  ]).join('\n');

export const formatSummaryMessage = (config, { durationLabel, peakPct, peakSite, secondsOver, alertCount, forefootPct, thresholdNorm }) =>
  withRecipient(config, [
    '📋 <b>GaitIQ · Session summary</b>',
    '',
    `<b>Duration</b>      ${esc(durationLabel)}`,
    `<b>Peak load</b>     ${esc(peakPct)}%  (${esc(peakSite)})`,
    `<b>Time over limit</b>  ${esc(secondsOver)} s  (limit ${esc(thresholdNorm)}%)`,
    `<b>Alerts</b>        ${esc(alertCount)}`,
    `<b>Forefoot / heel</b>  ${esc(forefootPct)} / ${esc(100 - forefootPct)}`,
  ]).join('\n');

export const formatTestMessage = (config) =>
  withRecipient(config, [
    '✅ <b>GaitIQ is connected</b>',
    '',
    'This is a test message. Pressure alerts from the insole will arrive in this chat.',
  ]).join('\n');

// ── Sending ────────────────────────────────────────────────────────────
export const sendTelegram = async (config, html) => {
  if (!isTelegramReady(config)) throw new Error('Telegram is not set up yet. Open Settings → Telegram.');
  await callTelegram(config.telegramBotToken, 'sendMessage', {
    chat_id: config.telegramChatId.trim(),
    text: html,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }, config.telegramApiBaseUrl);
  return { success: true, detail: 'Sent to Telegram.' };
};

export const sendTestMessage = (config) => sendTelegram(config, formatTestMessage(config));

/** Used by the live pipeline when a plantar site crosses its threshold. */
export const dispatchNotification = ({ config, ...details }) =>
  sendTelegram(config, formatOverloadMessage(config, details));

export const dispatchOffline = ({ config, silentSeconds }) =>
  sendTelegram(config, formatOfflineMessage(config, { silentSeconds }));

export const dispatchSummary = ({ config, ...details }) =>
  sendTelegram(config, formatSummaryMessage(config, details));
