import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import net from 'net'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __dirname   = fileURLToPath(new URL('.', import.meta.url))
const CONFIG_FILE = join(__dirname, 'config.json')
const WARN_LATENCY_MS = 1500

function healthCheckPlugin() {
  return {
    name: 'health-check',
    configureServer(server) {

      // Auth stubs — dev mode always reports auth disabled so the app loads without a login screen.
      server.middlewares.use('/api/auth', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ authEnabled: false, authenticated: true }))
      })
      server.middlewares.use('/api/login', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      })

      server.middlewares.use('/api/config', async (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method === 'GET') {
          try {
            const data = existsSync(CONFIG_FILE) ? JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) : []
            res.end(JSON.stringify(data))
          } catch { res.end('[]') }
          return
        }
        if (req.method === 'POST') {
          let body = ''
          for await (const chunk of req) body += chunk
          try {
            const data = JSON.parse(body)
            if (!Array.isArray(data)) throw new Error()
            writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2))
            res.end(JSON.stringify({ ok: true }))
          } catch { res.statusCode = 400; res.end(JSON.stringify({ error: 'bad request' })) }
          return
        }
        res.statusCode = 405; res.end()
      })

      server.middlewares.use('/api/check', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }

        let body = ''
        for await (const chunk of req) body += chunk

        let url
        try { url = JSON.parse(body).url } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
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
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ status, code, latency }))
        } catch {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ status: 'down', code: 0, latency: Date.now() - start }))
        }
      })

      server.middlewares.use('/api/ping', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }

        let body = ''
        for await (const chunk of req) body += chunk

        let host, port
        try { ({ host, port } = JSON.parse(body)) } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
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

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(result))
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), healthCheckPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
})
