<template>
  <div class="app">
    <TopBar
      :last-polled="lastPolled"
      :is-polling="isPolling"
      :proxy-online="proxyOnline"
      :server-count="servers.length"
      @refresh="pollAll"
      @add-server="openAddModal"
      @export="handleExport"
      @import="handleImport"
    />

    <main class="main">
      <SummaryBar :summary="summary" />

      <FilterBar
        :filter="activeFilter"
        :groups="groups"
        @update:filter="activeFilter = $event"
        @manage-groups="groupModalOpen = true"
      />

      <!-- empty state -->
      <div v-if="servers.length === 0" class="empty-state">
        <div class="empty-icon">⬡</div>
        <h2>No servers configured</h2>
        <p>Click <strong>+ Add Server</strong> in the top bar to add your first EC2 instance.</p>
      </div>

      <!-- server list -->
      <div v-else class="server-list">
        <ServerGroup
          v-for="server in filteredServers"
          :key="server.id"
          :server="server"
          :results="results"
          :ping-result="pingResults[server.id]"
          :filter="serverFilter"
          @poll-one="pollOne"
          @edit="openEditModal"
          @delete="handleDeleteServer"
        />
        <div v-if="filteredServers.length === 0 && activeFilter !== 'down'" class="empty-group-state">
          No servers in this group.
        </div>
      </div>
    </main>

    <!-- server config modal -->
    <ServerConfigModal
      v-if="modalOpen"
      :server="editingServer"
      @close="closeModal"
      @save="handleSaveServer"
    />

    <!-- group manager modal -->
    <GroupManagerModal
      v-if="groupModalOpen"
      :servers="servers"
      @close="groupModalOpen = false"
    />

    <!-- login overlay — shown when auth is required and no valid session -->
    <LoginOverlay
      v-if="showLogin"
      @authenticated="onAuthenticated"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useServers } from './useServers.js'
import { useChecker } from './useChecker.js'
import { useGroups } from './useGroups.js'
import TopBar from './components/TopBar.vue'
import SummaryBar from './components/SummaryBar.vue'
import FilterBar from './components/FilterBar.vue'
import ServerGroup from './components/ServerGroup.vue'
import ServerConfigModal from './components/ServerConfigModal.vue'
import GroupManagerModal from './components/GroupManagerModal.vue'
import LoginOverlay from './components/LoginOverlay.vue'

const { servers, whenReady, addServer, updateServer, removeServer } = useServers()
const {
  results, pingResults, lastPolled, isPolling, proxyOnline,
  summary, pollAll, pollOne, startPolling, stopPolling,
} = useChecker()
const { groups } = useGroups()

const activeFilter   = ref('all')
const modalOpen      = ref(false)
const editingServer  = ref(null)
const groupModalOpen = ref(false)
const showLogin      = ref(false)

// Reset filter if the active group is deleted.
watch(groups, (newGroups) => {
  if (activeFilter.value !== 'all' && activeFilter.value !== 'down') {
    if (!newGroups.find((g) => g.id === activeFilter.value)) {
      activeFilter.value = 'all'
    }
  }
})

// Servers visible in the list, accounting for group filter.
const filteredServers = computed(() => {
  if (activeFilter.value === 'all' || activeFilter.value === 'down') return servers.value
  const group = groups.value.find((g) => g.id === activeFilter.value)
  if (!group) return servers.value
  return servers.value.filter((s) => group.serverIds.includes(s.id))
})

// For ServerGroup: only pass 'down' through; everything else becomes 'all'
// (group filtering already happened at the server level above).
const serverFilter = computed(() =>
  activeFilter.value === 'down' ? 'down' : 'all',
)

// ── server modal ──
function openAddModal() {
  editingServer.value = null
  modalOpen.value = true
}

function openEditModal(server) {
  editingServer.value = server
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  editingServer.value = null
}

function handleSaveServer(server) {
  if (editingServer.value) {
    updateServer(server.id, server)
  } else {
    addServer(server)
  }
  closeModal()
  pollAll()
}

function handleDeleteServer(id) {
  removeServer(id)
}

function handleExport() {
  const blob = new Blob([JSON.stringify(servers.value, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'shift-monitor-servers.json'
  a.click()
  URL.revokeObjectURL(url)
}

function handleImport(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result)
      if (!Array.isArray(imported)) return
      for (const s of imported) {
        if (s.id && s.name && s.privateIp && Array.isArray(s.services)) {
          if (!servers.value.find((x) => x.id === s.id)) addServer(s)
        }
      }
      pollAll()
    } catch { /* invalid file — ignore */ }
  }
  reader.readAsText(file)
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth')
    if (!res.ok) return
    const { authEnabled, authenticated } = await res.json()
    if (authEnabled && !authenticated) {
      showLogin.value = true
    }
  } catch { /* proxy not running — proceed without auth gate */ }
}

function onAuthenticated() {
  showLogin.value = false
}

onMounted(async () => {
  await checkAuth()
  await whenReady
  startPolling()
})
onUnmounted(() => stopPolling())
</script>

<style scoped>
/* empty states */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  text-align: center;
  gap: 12px;
}

.empty-icon {
  font-size: 48px;
  color: var(--border2);
  line-height: 1;
}

.empty-state h2 {
  font-family: 'Syne', sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
}

.empty-state p {
  font-size: 14px;
  color: var(--muted);
  max-width: 360px;
}

.empty-state strong {
  color: var(--blue);
}

.empty-group-state {
  font-size: 13px;
  color: var(--muted);
  padding: 32px;
  text-align: center;
}
</style>
