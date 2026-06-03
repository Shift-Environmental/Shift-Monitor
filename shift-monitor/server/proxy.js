/**
 * shift-monitor proxy
 *
 * Runs alongside Vite (started by `npm run dev` via concurrently).
 * The browser cannot fetch your internal EC2 health endpoints directly
 * due to CORS.  This Node.js proxy makes those requests server-side
 * and returns normalised { status, code, latency } objects.
 *
 * Endpoints
 *   GET  /api/health                       → { ok: true }  (liveness)
 *   POST /api/check      { url }           → { status, code, latency }
 *   POST /api/check-port { host, port }    → { reachable, latency }
 */

import express from 'express'
import { Socket } from 'net'

const app = express()
app.use(express.json())

// Allow the Vite dev server (localhost) to call us during development.
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (_req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// Proxy liveness — the UI polls this at startup to confirm the proxy is running.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

/**
 * POST /api/check
 * Makes a real HTTP request to the given URL from Node.js (bypasses browser CORS).
 * Returns { status: 'up'|'warn'|'down', code: number, latency: number }
 */
app.post('/api/check', async (req, res) => {
  const { url } = req.body
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ status: 'down', code: 0, latency: 0, error: 'url required' })
  }

  const t0 = Date.now()
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    const latency = Date.now() - t0
    const status = !response.ok ? 'down' : latency > 1500 ? 'warn' : 'up'
    res.json({ status, code: response.status, latency })
  } catch (err) {
    const latency = Date.now() - t0
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError'
    res.json({
      status: 'down',
      code: 0,
      latency,
      error: isTimeout ? 'timeout' : (err.code ?? err.message),
    })
  }
})

/**
 * POST /api/check-port
 * TCP-connects to host:port to confirm the machine/port is reachable at the
 * network level (independent of whether the app process is healthy).
 * Returns { reachable: boolean, latency: number }
 */
app.post('/api/check-port', async (req, res) => {
  const { host, port } = req.body
  if (!host || !port) {
    return res.status(400).json({ reachable: false, latency: 0, error: 'host and port required' })
  }

  const t0 = Date.now()
  const reachable = await new Promise((resolve) => {
    const socket = new Socket()
    socket.setTimeout(3000)
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('timeout', () => { socket.destroy(); resolve(false) })
    socket.once('error',   () => { socket.destroy(); resolve(false) })
    socket.connect(Number(port), host)
  }).catch(() => false)

  res.json({ reachable, latency: Date.now() - t0 })
})

const PORT = process.env.PROXY_PORT ?? 3001
app.listen(PORT, () => {
  console.log(`[proxy] shift-monitor proxy → http://localhost:${PORT}`)
})
