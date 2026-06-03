import { ref } from 'vue'

export const HEALTH_PATHS = {
  java:    '/actuator/health',
  node:    '/health',
  python:  '/health',
  go:      '/healthz',
  ruby:    '/health',
  php:     '/health',
  rust:    '/health',
  dotnet:  '/health',
  elixir:  '/health',
  generic: '/',
}

export function svcUrl(server, svc) {
  return `http://${server.privateIp}:${svc.port}${svc.healthPath}`
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

const servers = ref([])

let resolveReady
const whenReady = new Promise((r) => { resolveReady = r })

async function persist(list) {
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(list),
    })
  } catch { /* server unreachable — in-memory state still updated */ }
}

async function initServers() {
  try {
    const res = await fetch('/api/config')
    if (res.ok) {
      const data = await res.json()
      servers.value = Array.isArray(data) ? data : []
    }
  } catch { /* leave as [] */ }
  resolveReady()
}

initServers()

function addServer(server) {
  const withId = { sshUser: 'ec2-user', ...server, id: server.id || uid() }
  servers.value = [...servers.value, withId]
  persist(servers.value)
}

function updateServer(id, updated) {
  servers.value = servers.value.map((s) => (s.id === id ? { ...s, ...updated, id } : s))
  persist(servers.value)
}

function removeServer(id) {
  servers.value = servers.value.filter((s) => s.id !== id)
  persist(servers.value)
}

export function useServers() {
  return { servers, whenReady, addServer, updateServer, removeServer, reloadServers: initServers }
}
