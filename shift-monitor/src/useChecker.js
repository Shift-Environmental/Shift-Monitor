import { ref, computed, watch } from 'vue'
import { useServers, svcUrl } from './useServers.js'

const POLL_INTERVAL   = 300_000
const HISTORY_SIZE    = 288   // 24h at 5-min polls
const LS_HISTORY_KEY  = 'shift-history'
const LS_PING_KEY    = 'shift-ping-history'

const { servers } = useServers()

// Module-level singleton — every useChecker() call shares these refs.
const results        = ref({})
const pingResults    = ref({})
const pingHistories  = ref({})
const lastPolled     = ref(null)
const isPolling      = ref(false)
const proxyOnline    = ref(true)
const sessionExpired = ref(false)
let intervalId       = null

function makeKey(serverId, svcName) {
  return `${serverId}:${svcName}`
}

// --- mock (VITE_MOCK=true, for UI development without real servers) ---

const MOCK = import.meta.env.VITE_MOCK === 'true'
const FLAKY = new Set(['ml-inference', 'report-builder', 'notification-svc'])

function rng(base, jitter) {
  return base + Math.floor(Math.random() * jitter)
}

function mockCheck(svcName) {
  if (FLAKY.has(svcName)) {
    const r = Math.random()
    if (r < 0.12) return { status: 'down', code: 503, latency: rng(2000, 1500) }
    if (r < 0.30) return { status: 'warn', code: 200, latency: rng(1600, 800) }
    return { status: 'up', code: 200, latency: rng(80, 200) }
  }
  const r = Math.random()
  if (r < 0.03) return { status: 'down', code: 500, latency: rng(4000, 1000) }
  if (r < 0.08) return { status: 'warn', code: 200, latency: rng(1600, 400) }
  return { status: 'up', code: 200, latency: rng(40, 160) }
}

// --- real check via the local proxy server ---

async function proxyCheck(url) {
  try {
    const res = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 401) { sessionExpired.value = true; return null }
    if (!res.ok) return { status: 'down', code: res.status, latency: 0 }
    return res.json()
  } catch {
    proxyOnline.value = false
    return { status: 'down', code: 0, latency: 0, error: 'proxy offline' }
  }
}

// --- localStorage history ---

function saveHistory() {
  const snapshot = {}
  for (const [key, val] of Object.entries(results.value)) {
    snapshot[key] = val.history
  }
  try {
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(snapshot))
    localStorage.setItem(LS_PING_KEY,    JSON.stringify(pingHistories.value))
  } catch { /* quota exceeded */ }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_HISTORY_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    const out = {}
    for (const [key, hist] of Object.entries(parsed)) {
      if (Array.isArray(hist)) out[key] = hist.slice(-HISTORY_SIZE)
    }
    return out
  } catch {
    return {}
  }
}

function loadPingHistory() {
  try {
    const raw = localStorage.getItem(LS_PING_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    const out = {}
    for (const [id, hist] of Object.entries(parsed)) {
      if (Array.isArray(hist)) out[id] = hist.slice(-HISTORY_SIZE)
    }
    return out
  } catch {
    return {}
  }
}

// --- server ping (TCP reachability on port 22) ---

function appendPingHistory(serverId, reachable) {
  const prev = pingHistories.value[serverId] ?? []
  pingHistories.value = {
    ...pingHistories.value,
    [serverId]: [...prev, reachable ? 'up' : 'down'].slice(-HISTORY_SIZE),
  }
}

async function pingServer(server) {
  const host = server.privateIp
  try {
    const res = await fetch('/api/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, port: 22 }),
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 401) { sessionExpired.value = true; return }
    if (!res.ok) {
      pingResults.value = { ...pingResults.value, [server.id]: { reachable: false, latency: null } }
      appendPingHistory(server.id, false)
      return
    }
    const data = await res.json()
    pingResults.value   = { ...pingResults.value, [server.id]: data }
    appendPingHistory(server.id, data.reachable)
  } catch {
    pingResults.value = { ...pingResults.value, [server.id]: { reachable: false, latency: null } }
    appendPingHistory(server.id, false)
  }
}

// --- core ---

function buildEmptyResult(history = []) {
  return { status: 'unknown', code: null, latency: null, version: null, info: null, history }
}

function initResults() {
  const persisted     = loadHistory()
  const persistedPing = loadPingHistory()
  const initial = {}
  for (const srv of servers.value) {
    for (const svc of srv.services) {
      const key = makeKey(srv.id, svc.name)
      initial[key] = buildEmptyResult(persisted[key] ?? [])
    }
    if (persistedPing[srv.id]) {
      pingHistories.value = { ...pingHistories.value, [srv.id]: persistedPing[srv.id] }
    }
  }
  results.value = initial
}

async function checkOne(server, svc) {
  const key     = makeKey(server.id, svc.name)
  const url     = svcUrl(server, svc)
  const outcome = MOCK ? mockCheck(svc.name) : await proxyCheck(url)
  if (!outcome) return  // session expired — don't update state
  const prev    = results.value[key] ?? buildEmptyResult()
  const history = [...prev.history, outcome.status].slice(-HISTORY_SIZE)

  results.value = {
    ...results.value,
    [key]: { status: outcome.status, code: outcome.code, latency: outcome.latency, version: outcome.version ?? prev.version ?? null, info: outcome.info ?? null, history },
  }
}

// When the server list changes (server added/edited/removed), keep results in sync.
watch(
  servers,
  (newServers) => {
    const updated = { ...results.value }

    // Add slots for any new services.
    for (const srv of newServers) {
      for (const svc of srv.services) {
        const key = makeKey(srv.id, svc.name)
        if (!updated[key]) updated[key] = buildEmptyResult()
      }
    }

    // Drop slots for removed servers / services.
    const validKeys = new Set(
      newServers.flatMap((srv) => srv.services.map((svc) => makeKey(srv.id, svc.name))),
    )
    for (const key of Object.keys(updated)) {
      if (!validKeys.has(key)) delete updated[key]
    }

    results.value = updated
  },
  { deep: true },
)

// --- public API ---

async function pollAll() {
  if (isPolling.value) return
  isPolling.value = true
  proxyOnline.value = true
  const tasks = []
  for (const srv of servers.value) {
    tasks.push(pingServer(srv))
    for (const svc of srv.services) {
      tasks.push(checkOne(srv, svc))
    }
  }
  await Promise.all(tasks)
  lastPolled.value = new Date()
  saveHistory()
  isPolling.value = false
}

async function pollOne(serverId, svcName) {
  const srv = servers.value.find((s) => s.id === serverId)
  if (!srv) return
  const svc = srv.services.find((s) => s.name === svcName)
  if (!svc) return
  await checkOne(srv, svc)
  saveHistory()
}

function startPolling() {
  initResults()
  pollAll()
  intervalId = setInterval(pollAll, POLL_INTERVAL)
}

function stopPolling() {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

const summary = computed(() => {
  let up = 0, down = 0, warn = 0, totalLatency = 0, latencyCount = 0
  for (const val of Object.values(results.value)) {
    if (val.status === 'up')   up++
    else if (val.status === 'down') down++
    else if (val.status === 'warn') warn++
    if (val.latency != null) { totalLatency += val.latency; latencyCount++ }
  }
  const avgLatency = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null
  return { up, down, warn, avgLatency }
})

export function useChecker() {
  return {
    results, pingResults, pingHistories, lastPolled, isPolling, proxyOnline,
    sessionExpired, summary, pollAll, pollOne, startPolling, stopPolling,
  }
}
