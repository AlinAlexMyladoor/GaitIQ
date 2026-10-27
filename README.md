# GaitIQ — Smart Insole Dashboard

Real-time plantar pressure monitoring (STM32 Blue Pill → Firebase RTDB → React).

## Run

```bash
npm install
npm run dev      # development
npm run build    # production build in dist/
```

Configure Firebase in `.env` (see `.env.example`). Without a valid database URL the app starts in Simulation mode.

## Highlights

- Light and dark themes (saved, follows system by default) in an "Ink & Verdigris" palette, with a custom insole logo
- Live status hero: safe / approaching / exceeded, gauge with threshold marker, gait phase, session timer
- Sensor cards with sparklines and threshold markers; heat-gradient plantar map
- Telemetry chart with 30 s / 1 min / 5 min windows, channel toggles, overload band
- Event log with filters, acknowledge-all and CSV export; telemetry CSV export; printable session report
- Command palette (`Ctrl/Cmd + K`) for every action, fullscreen mode, threshold presets
- Telegram alerts: guided bot setup (verify token, detect chat, send test), pressure alerts, insole-offline alerts, one-tap session summary
- Settings: ADC channel mapping, tare, Telegram

Design tokens live at the top of `src/index.css` — change `--primary` and the sensor colours there to re-theme the whole app.

## Telegram alerts

1. In Telegram open @BotFather → `/newbot` → copy the token.
2. Settings → Telegram → paste the token → **Verify**.
3. Open your bot, press **Start**, then **Detect** in Settings. Finally **Send test message** and switch on *Pressure alerts*.

The token is stored in the browser (localStorage) and sent only to api.telegram.org. If you host this publicly, move sending to a small backend so the token is not exposed to visitors.
