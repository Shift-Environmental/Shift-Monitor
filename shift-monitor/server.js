import 'dotenv/config'
import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { randomBytes, timingSafeEqual } from 'crypto'
import net from 'net'
import nodemailer from 'nodemailer'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST        = join(__dirname, 'dist')
const CONFIG_FILE = process.env.CONFIG_FILE || join(__dirname, 'config.json')
const PORT = Number(process.env.PORT) || 4173
const WARN_LATENCY_MS = 1500

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
}

// ── config ────────────────────────────────────────────────────────────────────

const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || ''
const AUTH_ENABLED    = Boolean(ACCESS_PASSWORD)
const ALLOWED_IPS     = (process.env.ALLOWED_IPS || '').split(',').map(s => s.trim()).filter(Boolean)
const TRUST_PROXY     = process.env.TRUST_PROXY === 'true'

const SMTP_HOST    = process.env.SMTP_HOST || ''
const SMTP_PORT    = Number(process.env.SMTP_PORT) || 587
const SMTP_SECURE  = process.env.SMTP_SECURE === 'true'
const SMTP_USER    = process.env.SMTP_USER || ''
const SMTP_PASS    = process.env.SMTP_PASS || ''
const ALERT_FROM   = process.env.ALERT_FROM || SMTP_USER
const ALERT_TO     = (process.env.ALERT_TO || '').split(',').map(s => s.trim()).filter(Boolean)

const MONITOR_INTERVAL_MS = Number(process.env.MONITOR_INTERVAL_MS) || 60_000
const FLAP_DOWN_COUNT     = 2  // consecutive downs before alerting

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || ''
const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL || ''

// ── IP whitelist ──────────────────────────────────────────────────────────────

function ipToInt(ip) {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0
}

function ipInCidr(ip, cidr) {
  if (!cidr.includes('/')) return ip === cidr
  const [network, bits] = cidr.split('/')
  const mask = ~((1 << (32 - parseInt(bits, 10))) - 1) >>> 0
  return (ipToInt(ip) & mask) === (ipToInt(network) & mask)
}

function getClientIp(req) {
  if (TRUST_PROXY) {
    const fwd = req.headers['x-forwarded-for']
    if (fwd) return fwd.split(',')[0].trim()
  }
  return req.socket.remoteAddress || ''
}

function isAllowedIp(req) {
  if (ALLOWED_IPS.length === 0) return true
  const raw = getClientIp(req)
  const ip  = raw === '::1' ? '127.0.0.1' : raw.replace(/^::ffff:/, '')
  return ALLOWED_IPS.some(cidr => ipInCidr(ip, cidr))
}

// ── sessions ──────────────────────────────────────────────────────────────────

const sessions = new Map()  // token -> expiresAt

function createSession() {
  const token = randomBytes(32).toString('hex')
  sessions.set(token, Date.now() + 86_400_000)  // 24 h
  return token
}

function validateSession(token) {
  if (!token) return false
  const exp = sessions.get(token)
  if (!exp) return false
  if (Date.now() > exp) { sessions.delete(token); return false }
  return true
}

function parseCookies(req) {
  const raw = req.headers.cookie || ''
  return Object.fromEntries(
    raw.split(';').map(s => s.trim()).filter(Boolean).map(s => {
      const i = s.indexOf('=')
      return [s.slice(0, i), s.slice(i + 1)]
    }),
  )
}

function isAuthenticated(req) {
  if (!AUTH_ENABLED) return true
  return validateSession(parseCookies(req).session)
}

// ── email ─────────────────────────────────────────────────────────────────────

const alertsEnabled = Boolean(SMTP_HOST && ALERT_TO.length)

const mailer = alertsEnabled
  ? nodemailer.createTransport({
      host:   SMTP_HOST,
      port:   SMTP_PORT,
      secure: SMTP_SECURE,
      auth:   SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null

async function sendAlert(subject, text) {
  const tasks = []

  if (mailer) {
    tasks.push(
      mailer.sendMail({ from: ALERT_FROM, to: ALERT_TO.join(', '), subject, text })
        .then(() => console.log(`[alert] email sent → ${subject}`))
        .catch(err => console.error('[alert] email failed:', err.message))
    )
  }

  if (SLACK_WEBHOOK_URL) {
    tasks.push(
      fetch(SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `*${subject}*\n${text}` }),
        signal: AbortSignal.timeout(5000),
      })
        .then(() => console.log(`[alert] slack sent → ${subject}`))
        .catch(err => console.error('[alert] slack failed:', err.message))
    )
  }

  if (TEAMS_WEBHOOK_URL) {
    tasks.push(
      fetch(TEAMS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message',
          attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
              '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
              type: 'AdaptiveCard', version: '1.4',
              body: [
                {
                  type: 'TextBlock',
                  text: `🔴 ${subject}`,
                  weight: 'bolder',
                  size: 'medium',
                  color: 'attention',
                  wrap: true,
                },
                {
                  type: 'TextBlock',
                  text: text.replace(/\n/g, '  \n'),
                  wrap: true,
                  spacing: 'small',
                },
              ],
            },
          }],
        }),
        signal: AbortSignal.timeout(5000),
      })
        .then(() => console.log(`[alert] teams sent → ${subject}`))
        .catch(err => console.error('[alert] teams failed:', err.message))
    )
  }

  await Promise.allSettled(tasks)
}

// ── background monitor + flap detection ──────────────────────────────────────
//
// General services: alert after FLAP_DOWN_COUNT consecutive 'down' checks,
// and separately after FLAP_DOWN_COUNT consecutive 'warn' checks.
// Each resets independently; recovery fires one notification when returning to 'up'.
//
// Disk services: level-based escalation (ok → warning → critical → full).
// One alert per upward transition; resets fully when returning to 'ok'.

const serviceState = new Map()

function getState(key) {
  if (!serviceState.has(key)) serviceState.set(key, {
    history: [], downAlertSent: false, warnAlertSent: false,
    downSince: null, warnSince: null,
  })
  return serviceState.get(key)
}

// Returns 'alert-down', 'alert-warn', 'recovered', or null
function recordStatus(key, status) {
  const state = getState(key)
  state.history.push(status)
  if (state.history.length > 5) state.history.shift()

  if (status === 'up') {
    const wasAlerting = state.warnAlertSent || state.downAlertSent
    state.warnAlertSent = false
    state.downAlertSent = false
    state.downSince = null
    state.warnSince = null
    return wasAlerting ? 'recovered' : null
  }

  if (status === 'warn') {
    if (state.downAlertSent) {
      state.downAlertSent = false
      state.downSince = null
    }
    if (!state.warnSince) state.warnSince = Date.now()
    const confirmedWarn = state.history.length >= FLAP_DOWN_COUNT &&
      state.history.slice(-FLAP_DOWN_COUNT).every(s => s === 'warn' || s === 'down')
    if (confirmedWarn && !state.warnAlertSent) {
      state.warnAlertSent = true
      return 'alert-warn'
    }
    return null
  }

  // status === 'down'
  if (state.warnAlertSent) {
    state.warnAlertSent = false
    state.warnSince = null
  }
  if (!state.downSince) state.downSince = Date.now()
  const confirmedDown = state.history.length >= FLAP_DOWN_COUNT &&
    state.history.slice(-FLAP_DOWN_COUNT).every(s => s === 'down')
  if (confirmedDown && !state.downAlertSent) {
    state.downAlertSent = true
    return 'alert-down'
  }
  return null
}

function downDuration(key) {
  const state = getState(key)
  const since = state.downSince || state.warnSince
  if (!since) return `${FLAP_DOWN_COUNT} min`
  const mins = Math.round((Date.now() - since) / 60_000)
  return mins <= 1 ? '1 min' : `${mins} mins`
}

// ── disk level-escalation ─────────────────────────────────────────────────────
// Fires once per upward transition (ok→warning, warning→critical, *→full).
// When level drops without returning to ok, lowers the alertedLevel so the
// next upward crossing re-alerts. Fires a recovery notification on return to ok.

const DISK_LEVELS     = { ok: 0, warning: 1, critical: 2, full: 3 }
const diskLevelState  = new Map()

function getDiskState(key) {
  if (!diskLevelState.has(key)) diskLevelState.set(key, { alertedLevel: null, lastInfo: '' })
  return diskLevelState.get(key)
}

// Returns 'escalated', 'recovered', or null
function recordDiskLevel(key, level, info) {
  const state = getDiskState(key)
  if (info) state.lastInfo = info

  const currentRank = DISK_LEVELS[level] ?? 0
  const alertedRank = state.alertedLevel !== null ? (DISK_LEVELS[state.alertedLevel] ?? 0) : -1

  if (level === 'ok') {
    const wasAlerted = state.alertedLevel !== null
    state.alertedLevel = null
    return wasAlerted ? 'recovered' : null
  }

  if (currentRank > alertedRank) {
    state.alertedLevel = level
    return 'escalated'
  }

  // Improved but not to ok (e.g. critical→warning): lower the tracked level
  // so the next escalation to critical will re-alert.
  if (currentRank < alertedRank && currentRank > 0) {
    state.alertedLevel = level
  }

  return null
}

async function monitorCheckHttp(url) {
  const start = Date.now()
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) })
    const latency = Date.now() - start
    const code = response.status
    if (code >= 200 && code < 300) return latency > WARN_LATENCY_MS ? 'warn' : 'up'
    if (code === 401 || code === 403) return latency > WARN_LATENCY_MS ? 'warn' : 'up'  // auth-gated = alive
    if (code >= 300 && code < 500) return 'warn'
    return 'down'
  } catch {
    return 'down'
  }
}

async function monitorCheckTcp(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(5000)
    socket.on('connect', () => { socket.destroy(); resolve('up') })
    socket.on('timeout', () => { socket.destroy(); resolve('down') })
    socket.on('error',   () => { socket.destroy(); resolve('down') })
    socket.connect(Number(port) || 22, host)
  })
}

async function runMonitorCycle() {
  let config
  try { config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) } catch { return }
  if (!Array.isArray(config)) return

  for (const server of config) {
    const host = server.privateIp || server.publicIp

    // TCP reachability (SSH port 22)
    const pingKey    = `${server.id}/ping`
    const pingStatus = await monitorCheckTcp(host, 22)
    const pingResult = recordStatus(pingKey, pingStatus)
    if (pingResult === 'alert-down') {
      const dur = downDuration(pingKey)
      await sendAlert(
        `${server.name} — server unreachable for ${dur}`,
        `Host "${server.name}" (${host}) has failed ${FLAP_DOWN_COUNT} consecutive TCP reachability checks.\n\nDown for: ${dur}\nTime: ${new Date().toISOString()}`,
      )
    } else if (pingResult === 'recovered') {
      await sendAlert(
        `${server.name} — server recovered`,
        `Host "${server.name}" (${host}) is reachable again.\nTime: ${new Date().toISOString()}`,
      )
    }

    if (!Array.isArray(server.services)) continue
    for (const svc of server.services) {
      const svcKey = `${server.id}/${svc.name}`
      const url    = svc.checkUrl || `http://${host}:${svc.port}${svc.healthPath || '/'}`

      if (svc.name === 'disk') {
        // Level-based disk alerting — parse JSON to get actual threshold level
        try {
          const res  = await fetch(url, { signal: AbortSignal.timeout(7000) })
          const json = await res.json().catch(() => ({}))
          const level  = (json.status === 'error' ? 'critical' : json.status) || 'ok'
          const info   = json.info || ''
          const result = recordDiskLevel(svcKey, level, info)
          if (result === 'escalated') {
            const alertedLevel = getDiskState(svcKey).alertedLevel
            await sendAlert(
              `${server.name} / disk — ${alertedLevel.toUpperCase()}`,
              `Disk on "${server.name}" has reached the ${alertedLevel} threshold.\n\nUsage: ${info || 'unknown'}\nTime: ${new Date().toISOString()}`,
            )
          } else if (result === 'recovered') {
            const lastInfo = getDiskState(svcKey).lastInfo
            await sendAlert(
              `${server.name} / disk — back to normal`,
              `Disk on "${server.name}" has returned to normal.\n\nUsage: ${lastInfo || 'unknown'}\nTime: ${new Date().toISOString()}`,
            )
          }
        } catch {
          const result = recordStatus(svcKey, 'down')
          if (result === 'alert-down') {
            await sendAlert(
              `${server.name} / disk — unreachable`,
              `Disk health endpoint on "${server.name}" is unreachable.\nURL: ${url}\nTime: ${new Date().toISOString()}`,
            )
          }
        }
      } else {
        // Standard flap-detected alerting for all other services
        const status = await monitorCheckHttp(url)
        const result = recordStatus(svcKey, status)
        if (result === 'alert-down') {
          const dur = downDuration(svcKey)
          await sendAlert(
            `${server.name} / ${svc.name} — down for ${dur}`,
            `Service "${svc.name}" on "${server.name}" has been unresponsive for ${dur}.\n\nURL: ${url}\nTime: ${new Date().toISOString()}`,
          )
        } else if (result === 'alert-warn') {
          const dur = downDuration(svcKey)
          await sendAlert(
            `${server.name} / ${svc.name} — degraded for ${dur}`,
            `Service "${svc.name}" on "${server.name}" has been returning errors or high latency for ${dur}.\n\nURL: ${url}\nTime: ${new Date().toISOString()}`,
          )
        } else if (result === 'recovered') {
          await sendAlert(
            `${server.name} / ${svc.name} — recovered`,
            `Service "${svc.name}" on "${server.name}" has recovered.\nTime: ${new Date().toISOString()}`,
          )
        }
      }
    }
  }
}

// Start monitor after a short warm-up delay so the process settles first.
setTimeout(() => {
  runMonitorCycle()
  setInterval(runMonitorCycle, MONITOR_INTERVAL_MS)
}, 5000)

// ── /api/auth — session status ────────────────────────────────────────────────

function handleAuthCheck(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ authEnabled: AUTH_ENABLED, authenticated: isAuthenticated(req) }))
}

// ── /api/login ────────────────────────────────────────────────────────────────

async function handleLogin(req, res) {
  let body = ''
  for await (const chunk of req) body += chunk
  let password
  try { password = JSON.parse(body).password } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'bad request' }))
    return
  }

  const correct = (() => {
    if (!AUTH_ENABLED) return true
    const a = Buffer.from(String(password))
    const b = Buffer.from(ACCESS_PASSWORD)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  })()

  if (correct) {
    const token = createSession()
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': `session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=86400`,
    })
    res.end(JSON.stringify({ ok: true }))
  } else {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'invalid password' }))
  }
}

// ── /api/logout ───────────────────────────────────────────────────────────────

function handleLogout(req, res) {
  const token = parseCookies(req).session
  if (token) sessions.delete(token)
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Set-Cookie': 'session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0',
  })
  res.end(JSON.stringify({ ok: true }))
}

// ── /api/config ───────────────────────────────────────────────────────────────

function readConfig() {
  try {
    if (!existsSync(CONFIG_FILE)) return []
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
  } catch { return [] }
}

function handleConfigGet(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(readConfig()))
}

async function handleConfigPost(req, res) {
  let body = ''
  for await (const chunk of req) body += chunk
  try {
    const data = JSON.parse(body)
    if (!Array.isArray(data)) throw new Error()
    writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'bad request' }))
  }
}

// ── /api/check — HTTP health check ───────────────────────────────────────────

function extractVersionFromJson(json) {
  if (!json || typeof json !== 'object') return null
  const candidates = [
    json.version,
    json.build?.version,
    json.info?.build?.version,
    json.status?.version,
    json.data?.version,
    json.metadata?.version,
    json.app?.version,
    json.release?.version,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return null
}

function extractVersionFromHeaders(headers) {
  const keys = ['x-service-version', 'x-version', 'x-app-version', 'server-version']
  for (const key of keys) {
    const value = headers.get(key)
    if (value) return value.trim()
  }
  return null
}

function parseVersionFromText(text) {
  const normalized = text.replace(/\r?\n/g, ' ')
  const match = normalized.match(/(?:version|app_version|build_version)\s*[:=]\s*['"]?([\w.-]+)['"]?/i)
  if (match?.[1]) return match[1].trim()
  const semverMatch = normalized.match(/\bv?(\d+\.\d+\.\d+(?:[-+][\w.]+)?)\b/)
  return semverMatch?.[1] ?? null
}

async function handleCheck(req, res) {
  let body = ''
  for await (const chunk of req) body += chunk

  let url
  try { url = JSON.parse(body).url } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'bad request' }))
    return
  }

  const start = Date.now()
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) })
    const latency = Date.now() - start
    const code = response.status
    const status = (code >= 200 && code < 300) || code === 401 || code === 403
      ? (latency > WARN_LATENCY_MS ? 'warn' : 'up')
      : code >= 300 && code < 500 ? 'warn' : 'down'

    const text = await response.text()
    let version = null
    let info = null
    try {
      const json = JSON.parse(text)
      version = extractVersionFromJson(json)
      if (typeof json.info === 'string') info = json.info
    } catch {
      // Non-JSON response; fall through to text/header parsing.
    }

    version = version
      || extractVersionFromHeaders(response.headers)
      || parseVersionFromText(text)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status, code, latency, version, info }))
  } catch {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'down', code: 0, latency: Date.now() - start }))
  }
}

// ── /api/ping — TCP reachability check ───────────────────────────────────────

async function handlePing(req, res) {
  let body = ''
  for await (const chunk of req) body += chunk

  let host, port
  try { ({ host, port } = JSON.parse(body)) } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'bad request' }))
    return
  }

  const start = Date.now()
  const result = await new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(5000)
    socket.on('connect', () => { socket.destroy(); resolve({ reachable: true,  latency: Date.now() - start }) })
    socket.on('timeout', () => { socket.destroy(); resolve({ reachable: false, latency: 5000 }) })
    socket.on('error',   () => { socket.destroy(); resolve({ reachable: false, latency: Date.now() - start }) })
    socket.connect(Number(port) || 22, host)
  })

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result))
}

// ── static file server (SPA) ──────────────────────────────────────────────────

function serveStatic(req, res) {
  const urlPath = req.url.split('?')[0]
  let filePath = join(DIST, urlPath === '/' ? 'index.html' : urlPath)
  if (!existsSync(filePath)) filePath = join(DIST, 'index.html')

  try {
    const content = readFileSync(filePath)
    const mime = MIME[extname(filePath)] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': mime })
    res.end(content)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}

// ── main server ───────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  // IP whitelist — hard block before anything else
  if (!isAllowedIp(req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('Forbidden')
    return
  }

  // Auth check for all API routes except /api/auth and /api/login
  const isApi    = req.url.startsWith('/api/')
  const isPublic = req.url === '/api/auth' || req.url === '/api/login'
  if (isApi && !isPublic && !isAuthenticated(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'unauthorized' }))
    return
  }

  if (req.url === '/api/auth'   && req.method === 'GET')  return handleAuthCheck(req, res)
  if (req.url === '/api/login'  && req.method === 'POST') return handleLogin(req, res)
  if (req.url === '/api/logout' && req.method === 'POST') return handleLogout(req, res)
  if (req.url === '/api/config' && req.method === 'GET')  return handleConfigGet(req, res)
  if (req.url === '/api/config' && req.method === 'POST') return handleConfigPost(req, res)
  if (req.url === '/api/check'  && req.method === 'POST') return handleCheck(req, res)
  if (req.url === '/api/ping'   && req.method === 'POST') return handlePing(req, res)
  serveStatic(req, res)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`shift/monitor  →  http://0.0.0.0:${PORT}`)
  console.log(`auth           →  ${AUTH_ENABLED ? 'password required' : 'disabled'}`)
  console.log(`ip whitelist   →  ${ALLOWED_IPS.length ? ALLOWED_IPS.join(', ') : 'off'}`)
  console.log(`email alerts   →  ${alertsEnabled ? `on  (→ ${ALERT_TO.join(', ')})` : 'disabled'}`)
})
