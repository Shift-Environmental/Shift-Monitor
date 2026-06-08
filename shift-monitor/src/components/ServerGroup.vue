<template>
  <div v-if="visibleServices.length > 0 || filter !== 'down'" class="server-group">

    <!-- ── server header ── -->
    <div class="server-header" :class="`header-${serverStatus}`">
      <div class="server-meta">
        <i class="mdi mdi-server server-icon" :class="`icon-${serverStatus}`"></i>
        <div class="server-name-block">
          <span class="server-name">{{ server.name }}</span>
          <span class="server-ip">{{ server.privateIp }}</span>
        </div>
        <span v-if="server.region" class="region-badge">
          <i class="mdi mdi-earth"></i>
          {{ server.region }}
        </span>
        <span class="svc-count" :class="`count-${serverStatus}`">
          {{ upCount }}/{{ server.services.length }} up
        </span>
      </div>

      <div class="header-actions">
        <button
          class="connect-btn"
          :class="{ copied: sshCopied }"
          :title="`Copy: ssh ${server.sshUser || 'ec2-user'}@${server.privateIp}`"
          @click="copySSH"
        >
          <i class="mdi mdi-console-line"></i>
          <span>{{ sshCopied ? 'Copied!' : 'SSH' }}</span>
        </button>
        <button class="icon-btn" title="Edit server" @click="$emit('edit', server)">
          <i class="mdi mdi-pencil-outline"></i>
        </button>
        <button class="icon-btn danger" title="Remove server" @click="confirmDelete">
          <i class="mdi mdi-trash-can-outline"></i>
        </button>
      </div>
    </div>

    <!-- ── ping row ── -->
    <div class="ping-row" :class="pingRowClass">
      <span class="ping-left">
        <i class="mdi mdi-lan-connect ping-icon"></i>
        <span class="ping-label">TCP :22</span>
        <span class="ping-status">{{ pingLabel }}</span>
      </span>
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
      <div class="table-scroll">
        <div class="table-header">
          <span>Service</span>
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
      </div>
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

const PING_BUCKET_SIZE    = 12
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
  border-radius: 12px;
  overflow: hidden;
}

/* ── header ── */
.server-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
  gap: 12px;
}

.header-up   { border-left: 3px solid var(--up); }
.header-down { border-left: 3px solid var(--down); }
.header-warn { border-left: 3px solid var(--warn); }

.server-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.server-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.icon-up      { color: var(--up); }
.icon-down    { color: var(--down); }
.icon-warn    { color: var(--warn); }
.icon-unknown { color: var(--muted); }

.server-name-block {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.server-name {
  font-family: 'Syne', sans-serif;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  line-height: 1.2;
}

.server-ip {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}

.region-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 2px 8px;
  background: rgba(0, 150, 199, 0.1);
  color: var(--blue);
  border: 1px solid rgba(0, 150, 199, 0.25);
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.region-badge .mdi { font-size: 12px; }

.svc-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
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
  font-family: 'Syne', sans-serif;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.25);
  border-radius: 6px;
  color: var(--up);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.connect-btn .mdi { font-size: 15px; }

.connect-btn:hover { background: rgba(34, 197, 94, 0.15); border-color: var(--up); }
.connect-btn.copied { background: rgba(34, 197, 94, 0.2); border-color: var(--up); }

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 6px;
  color: var(--muted);
  font-size: 17px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.icon-btn:hover { color: var(--text); border-color: var(--blue); }

.icon-btn.danger:hover {
  color: var(--down);
  border-color: var(--down);
  background: rgba(239, 68, 68, 0.08);
}

/* ── table scroll wrapper (horizontal scroll on mobile) ── */
.table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* ── table header — matches ServiceRow grid ── */
.table-header {
  display: grid;
  grid-template-columns: minmax(140px, 2fr) 90px 56px 76px 64px 1fr 38px;
  gap: 8px;
  padding: 6px 16px;
  font-family: 'Syne', sans-serif;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.06);
  min-width: 580px;
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
  gap: 12px;
  padding: 7px 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.06);
}

.ping-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.ping-icon {
  font-size: 15px;
  flex-shrink: 0;
}

.ping-up   .ping-icon { color: var(--up); }
.ping-down .ping-icon { color: var(--down); }

.ping-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  flex-shrink: 0;
}

.ping-status {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.ping-up      .ping-status { color: var(--up); }
.ping-down    .ping-status { color: var(--down); }
.ping-unknown .ping-status { color: var(--muted); }

.ping-latency {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  margin-left: auto;
  flex-shrink: 0;
}

.ping-sparkbar {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  overflow: hidden;
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
