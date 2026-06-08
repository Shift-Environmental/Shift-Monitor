<template>
  <div v-if="visibleServices.length > 0 || filter !== 'down'" class="server-group">

    <!-- ── server header ── -->
    <div class="server-header">
      <div class="server-meta">
        <!-- aggregate status dot -->
        <span class="server-status-dot" :class="`dot-${serverStatus}`" :title="serverStatus"></span>
        <span class="server-name">{{ server.name }}</span>
        <span class="server-ip">{{ server.privateIp }}</span>
        <span v-if="server.region" class="region-badge">{{ server.region }}</span>
        <span class="svc-count" :class="`count-${serverStatus}`">
          {{ upCount }}/{{ server.services.length }} up
        </span>
      </div>

      <div class="header-actions">
        <!-- SSH connect -->
        <button
          class="connect-btn"
          :class="{ copied: sshCopied }"
          :title="`Copy: ssh ${server.sshUser || 'ec2-user'}@${server.privateIp}`"
          @click="copySSH"
        >
          <span class="connect-icon">⌨</span>
          {{ sshCopied ? 'Copied!' : 'SSH' }}
        </button>

        <!-- Edit -->
        <button class="icon-btn" title="Edit server" @click="$emit('edit', server)">
          ✎
        </button>

        <!-- Delete -->
        <button
          class="icon-btn danger"
          title="Remove server"
          @click="confirmDelete"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- ── ping row ── -->
    <div class="ping-row" :class="pingRowClass">
      <span class="ping-label">host</span>
      <span class="ping-type">tcp/:22</span>
      <span class="ping-status">{{ pingLabel }}</span>
      <span class="ping-latency">{{ pingLatency }}</span>
      <span class="ping-sparkbar" aria-label="Ping history">
        <span
          v-for="(entry, i) in paddedPingHistory"
          :key="i"
          class="ping-spark-seg"
          :class="`spark-${entry}`"
        ></span>
      </span>
    </div>

    <!-- ── no services match filter ── -->
    <div v-if="visibleServices.length === 0" class="no-match">
      No services match this filter on {{ server.name }}.
    </div>

    <!-- ── service table ── -->
    <template v-else>
      <div class="table-header">
        <span>Service</span>
        <span>Lang</span>
        <span>Status</span>
        <span>Code</span>
        <span>Latency</span>
        <span>Version</span>
        <span>24h</span>
        <span></span>
      </div>

      <ServiceRow
        v-for="svc in visibleServices"
        :key="svc.name"
        :service="svc"
        :result="results[rowKey(server.id, svc.name)]"
        @check="$emit('poll-one', server.id, svc.name)"
      />
    </template>

  </div>

  <ConfirmDialog
    v-if="confirmingDelete"
    :message="`Remove '${server.name}' from the dashboard?`"
    confirm-label="Remove"
    @confirm="doDelete"
    @cancel="confirmingDelete = false"
  />
</template>

<script setup>
import { ref, computed } from 'vue'
import ServiceRow from './ServiceRow.vue'
import ConfirmDialog from './ConfirmDialog.vue'

const props = defineProps({
  server:      { type: Object,  required: true },
  results:     { type: Object,  required: true },
  pingResult:  { type: Object,  default: null },
  pingHistory: { type: Array,   default: () => [] },
  filter:      { type: String,  required: true },
})

const emit = defineEmits(['poll-one', 'edit', 'delete'])

function rowKey(serverId, svcName) {
  return `${serverId}:${svcName}`
}

const visibleServices = computed(() =>
  props.server.services.filter((svc) => {
    if (props.filter === 'down') {
      const r = props.results[rowKey(props.server.id, svc.name)]
      return r && (r.status === 'down' || r.status === 'warn')
    }
    return true
  }),
)

// Aggregate server status from individual service results.
const serverStatus = computed(() => {
  const statuses = props.server.services.map(
    (svc) => props.results[rowKey(props.server.id, svc.name)]?.status ?? 'unknown',
  )
  if (statuses.every((s) => s === 'unknown')) return 'unknown'
  if (statuses.some((s)  => s === 'down'))    return 'down'
  if (statuses.some((s)  => s === 'warn'))    return 'warn'
  return 'up'
})

const upCount = computed(() =>
  props.server.services.filter(
    (svc) => props.results[rowKey(props.server.id, svc.name)]?.status === 'up',
  ).length,
)

const pingRowClass = computed(() => {
  if (!props.pingResult) return 'ping-unknown'
  return props.pingResult.reachable ? 'ping-up' : 'ping-down'
})

const pingLabel = computed(() => {
  if (!props.pingResult) return '—'
  return props.pingResult.reachable ? 'REACHABLE' : 'UNREACHABLE'
})

const pingLatency = computed(() => {
  const ms = props.pingResult?.latency
  if (ms == null) return '—'
  return `${ms}ms`
})

const PING_BUCKET_SIZE     = 12
const PING_DISPLAY_BUCKETS = 24

const paddedPingHistory = computed(() => {
  const hist = props.pingHistory ?? []
  const buckets = []
  for (let i = 0; i < hist.length; i += PING_BUCKET_SIZE) {
    const slice = hist.slice(i, i + PING_BUCKET_SIZE)
    if (slice.includes('down')) buckets.push('down')
    else if (slice.includes('up')) buckets.push('up')
    else buckets.push('empty')
  }
  const padCount = Math.max(0, PING_DISPLAY_BUCKETS - buckets.length)
  return [...Array(padCount).fill('empty'), ...buckets]
})

// delete confirmation
const confirmingDelete = ref(false)

function confirmDelete() {
  confirmingDelete.value = true
}

function doDelete() {
  confirmingDelete.value = false
  emit('delete', props.server.id)
}

// SSH copy-to-clipboard
const sshCopied = ref(false)

function copySSH() {
  const user = props.server.sshUser || 'ec2-user'
  const cmd = `ssh ${user}@${props.server.privateIp}`
  navigator.clipboard.writeText(cmd).then(() => {
    sshCopied.value = true
    setTimeout(() => { sshCopied.value = false }, 2000)
  })
}

</script>

<style scoped>
.server-group {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

/* ── header ── */
.server-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
  gap: 12px;
}

.server-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.server-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-up      { background: var(--up);    box-shadow: 0 0 5px var(--up); }
.dot-down    { background: var(--down);  box-shadow: 0 0 5px var(--down); }
.dot-warn    { background: var(--warn);  box-shadow: 0 0 5px var(--warn); }
.dot-unknown { background: var(--muted); }

.server-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
}

.server-ip {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

.region-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 2px 7px;
  background: rgba(0, 150, 199, 0.12);
  color: var(--blue);
  border: 1px solid rgba(0, 150, 199, 0.28);
  border-radius: 4px;
  letter-spacing: 0.03em;
  white-space: nowrap;
  flex-shrink: 0;
}

.svc-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.count-up   { color: var(--up); }
.count-down { color: var(--down); }
.count-warn { color: var(--warn); }

/* header action buttons */
.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.connect-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  padding: 4px 10px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.25);
  border-radius: 5px;
  color: var(--up);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.connect-btn:hover {
  background: rgba(34, 197, 94, 0.15);
  border-color: var(--up);
}

.connect-btn.copied {
  background: rgba(34, 197, 94, 0.2);
  border-color: var(--up);
}

.connect-icon {
  font-size: 13px;
}

.icon-btn {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 5px;
  color: var(--muted);
  font-size: 13px;
  padding: 4px 9px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.icon-btn:hover {
  color: var(--text);
  border-color: var(--blue);
}

.icon-btn.danger:hover {
  color: var(--down);
  border-color: var(--down);
  background: rgba(239, 68, 68, 0.08);
}

/* ── table ── */
.table-header {
  display: grid;
  grid-template-columns: 190px 84px 100px 64px 88px 64px 1fr 68px;
  padding: 7px 16px;
  font-family: 'Syne', sans-serif;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
}

.no-match {
  padding: 16px;
  font-size: 13px;
  color: var(--muted);
  font-style: italic;
}

/* ── ping row ── */
.ping-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 7px 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(0,0,0,0.08);
}

.ping-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  width: 44px;
  flex-shrink: 0;
}

.ping-type {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  flex-shrink: 0;
}

.ping-status {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.ping-latency {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  margin-left: auto;
}

.ping-up   .ping-status { color: var(--up); }
.ping-down .ping-status { color: var(--down); }
.ping-unknown .ping-status { color: var(--muted); }

.ping-sparkbar {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  overflow: hidden;
  margin-left: 8px;
}

.ping-spark-seg {
  width: 8px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}

.spark-up    { background: var(--up);     opacity: 0.75; }
.spark-down  { background: var(--down);   opacity: 0.9; }
.spark-empty { background: var(--border); opacity: 0.35; }
</style>
