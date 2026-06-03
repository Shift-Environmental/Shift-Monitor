import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import net from 'net'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST        = join(__dirname, 'dist')
const CONFIG_FILE = join(__dirname, 'config.json')
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

// ── /api/config — shared server config on disk ───────────────────────────────

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

// ── /api/check — HTTP health check ──────────────────────────────────────────

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
    const status = code >= 200 && code < 300
      ? (latency > WARN_LATENCY_MS ? 'warn' : 'up')
      : 'down'
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status, code, latency }))
  } catch {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'down', code: 0, latency: Date.now() - start }))
  }
}

// ── /api/ping — TCP reachability check ──────────────────────────────────────

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

// ── static file server (SPA) ─────────────────────────────────────────────────

function serveStatic(req, res) {
  // Strip query string
  const urlPath = req.url.split('?')[0]
  let filePath = join(DIST, urlPath === '/' ? 'index.html' : urlPath)

  // SPA fallback — unknown paths serve index.html so Vue Router works
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

// ── main server ──────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  if (req.url === '/api/config' && req.method === 'GET')  return handleConfigGet(req, res)
  if (req.url === '/api/config' && req.method === 'POST') return handleConfigPost(req, res)
  if (req.url === '/api/check'  && req.method === 'POST') return handleCheck(req, res)
  if (req.url === '/api/ping'   && req.method === 'POST') return handlePing(req, res)
  serveStatic(req, res)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`shift/monitor  →  http://0.0.0.0:${PORT}`)
})
