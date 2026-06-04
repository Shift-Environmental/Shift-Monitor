# Shift Monitor

Server health dashboard for Shift Coastal Technologies. Built with Vue 3 + Vite, backed by a Node.js server that proxies health checks, stores config, and sends alerts.

**Live:** https://monitor.shiftcims.com — password protected

---

## What it does

- Polls HTTP health endpoints and TCP reachability (port 22) for every configured server
- Displays live status, response codes, latency, and a 3-day sparkbar history (one bar = 1 hour)
- Stores all server config server-side — every team member sees the same state
- Sends Teams (and optionally Slack/email) alerts after 2 consecutive failures (~10 min downtime)
- Password-protected login with 24-hour session cookies
- Light and dark mode, per-browser preference

---

## Architecture

```
Browser (Vue 3 SPA)
  │  POST /api/check    — proxied HTTP health check
  │  POST /api/ping     — proxied TCP reachability check
  │  GET/POST /api/config — read/write server list
  │  POST /api/login    — session auth
  ▼
server.js (Node.js, port 4173)
  │  serves dist/
  │  handles all /api/* routes
  │  runs background monitor every 5 min → sends alerts
  ▼
nginx (port 80/443) → reverse proxy → server.js
```

Config is stored at `~/shift-data/config.json` — outside the repo so deploys never touch it.

---

## Local development

```bash
cd shift-monitor
npm install
npm run dev        # Vite dev server at http://localhost:3000
```

Auth is disabled in dev mode — the Vite plugin stubs `/api/auth` to return `{ authEnabled: false }`. Config reads/writes go to `shift-monitor/config.json` locally.

To run the full production server locally:

```bash
cp .env.example .env   # set ACCESS_PASSWORD etc.
npm start              # node server.js on port 4173
```

---

## Environment variables (`.env`)

| Variable | Description | Default |
|---|---|---|
| `ACCESS_PASSWORD` | Dashboard password. Leave blank to disable auth. | *(disabled)* |
| `ALLOWED_IPS` | Comma-separated IPs/CIDRs allowed to connect. Leave blank to allow all. | *(all)* |
| `TRUST_PROXY` | Set `true` when behind nginx (uses `X-Forwarded-For`). | `false` |
| `CONFIG_FILE` | Path to server config JSON. | `./config.json` |
| `MONITOR_INTERVAL_MS` | How often the server-side monitor checks each service. | `300000` (5 min) |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL for alerts. | *(disabled)* |
| `TEAMS_WEBHOOK_URL` | Microsoft Teams incoming webhook URL for alerts. | *(disabled)* |
| `SMTP_HOST` | SMTP server for email alerts. | *(disabled)* |
| `SMTP_PORT` | SMTP port. | `587` |
| `SMTP_USER` | SMTP username. | — |
| `SMTP_PASS` | SMTP password / app password. | — |
| `ALERT_FROM` | From address for alert emails. | *(SMTP_USER)* |
| `ALERT_TO` | Comma-separated alert recipients. | — |

---

## Alert behaviour

The server-side background monitor runs independently of the browser. It tracks consecutive failures per service and alerts after **2 consecutive downs** (10 minutes at the default 5-minute interval).

Alert resets automatically when the service recovers — the next outage sends a fresh notification.

Alert channels fire in parallel. Example Teams message:

> 🔴 **SFN / cloud-api — down for 10 mins**
> Service "cloud-api" on "SFN" has been unresponsive for 10 mins.
> URL: http://172.31.30.17:9000/api/projects
> Time: 2026-06-04T19:24:28.000Z

---

## Health check behaviour

| HTTP response | Dashboard status |
|---|---|
| 2xx | **UP** (WARN if latency > 1500 ms) |
| 401 / 403 | **UP** — auth-gated endpoint, service is alive |
| 3xx / other 4xx | **WARN** — responding but no health route |
| 5xx | **DOWN** |
| Timeout / connection refused | **DOWN** |

For WebSocket services (Socket.IO), use the polling transport path as the Check URL:
```
http://host:9001/ws/telemetry/?EIO=4&transport=polling
```

For HTTPS or domain-based endpoints, set a **Check URL** on the service — it overrides the auto-built `http://host:port/path` URL entirely.

---

## Production deployment (ca-west-1 EC2)

**Server:** `ec2-16-174-98-31.ca-west-1.compute.amazonaws.com`  
**Key:** `~/.ssh/shift-monitor.pem`  
**Repo:** `~/Shift-Monitor/`  
**Config:** `~/shift-data/config.json` (persistent, never touched by deploys)  
**Service:** systemd `shift-monitor.service`

### Deploy latest code

```bash
ssh -i "~/.ssh/shift-monitor.pem" admin@<monitor-server>
~/Shift-Monitor/deploy.sh
```

`deploy.sh` does: `git pull → npm install → npm run build → systemctl restart shift-monitor`

### What deploy covers

| Change type | Covered by deploy.sh | Action needed |
|---|---|---|
| Source code (Vue, server.js) | ✅ | Just run deploy.sh |
| New npm dependencies | ✅ | Just run deploy.sh |
| `.env` changes | ❌ | Edit `~/Shift-Monitor/shift-monitor/.env` then `sudo systemctl restart shift-monitor` |
| Server list / config | ❌ | Edit via dashboard UI or `~/shift-data/config.json` directly |
| systemd service file | ❌ | Edit `/etc/systemd/system/shift-monitor.service` then `sudo systemctl daemon-reload && sudo systemctl restart shift-monitor` |
| nginx config | ❌ | Edit `/etc/nginx/sites-available/shift-monitor` then `sudo nginx -t && sudo systemctl reload nginx` |

### Useful server commands

```bash
sudo systemctl status shift-monitor      # service status
sudo journalctl -u shift-monitor -f      # live logs
sudo systemctl restart shift-monitor     # restart
cat ~/shift-data/config.json             # view server config
cat ~/Shift-Monitor/shift-monitor/.env   # view env config
```

---

## Adding a server

1. Open https://monitor.shiftcims.com and log in
2. Click **+ Add Server** — enter the host (IP or hostname) and SSH user
3. Click **+ Add Service** for each process to monitor
4. For services without a `/health` endpoint, set a **Check URL** to override the auto-built URL

Config saves immediately and is visible to all users on the team.

---

## Repo structure

```
Shift-Monitor/
├── shift-monitor/
│   ├── src/
│   │   ├── App.vue
│   │   ├── useServers.js       # server config, /api/config
│   │   ├── useChecker.js       # polling, history, ping
│   │   ├── useTheme.js         # light/dark mode
│   │   └── components/
│   │       ├── TopBar.vue
│   │       ├── ServerGroup.vue
│   │       ├── ServiceRow.vue
│   │       ├── ServerConfigModal.vue
│   │       ├── LoginOverlay.vue
│   │       └── ...
│   ├── server.js               # production Node.js server + background monitor
│   ├── vite.config.js          # dev server with API stubs
│   └── package.json
└── deploy.sh                   # git pull + build + restart
```
