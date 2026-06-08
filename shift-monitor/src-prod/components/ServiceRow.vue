<template>
  <div class="service-row" :class="rowStatusClass">
    <!-- 1. Service name -->
    <span class="svc-name" :title="service.name">{{ service.name }}</span>

    <!-- 2. Language badge -->
    <span class="lang-badge" :class="`lang-${service.language}`">{{ langLabel }}</span>

    <!-- 3. Status badge -->
    <span class="status-badge" :class="badgeStatusClass">
      <span class="status-dot"></span>
      {{ statusLabel }}
    </span>

    <!-- 4. HTTP status code -->
    <span class="http-code">{{ result?.code ? result.code : '—' }}</span>

    <!-- 5. Latency -->
    <span class="latency" :class="latencyClass">{{ latencyLabel }}</span>

    <!-- 6. Sparkbar — 24 hourly buckets = 24h -->
    <span class="sparkbar" aria-label="24-hour history">
      <span
        v-for="(entry, i) in hourlyHistory"
        :key="i"
        class="spark-seg"
        :class="`spark-${entry}`"
      ></span>
    </span>

    <!-- 7. Manual check button -->
    <button
      class="check-btn"
      :class="{ flash: flashing }"
      title="Check this service now"
      @click="handleCheck"
    >
      check
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  service: { type: Object, required: true },
  result:  { type: Object, default: null },
})

const emit = defineEmits(['check'])

const flashing = ref(false)

function handleCheck() {
  emit('check')
  flashing.value = true
  setTimeout(() => {
    flashing.value = false
  }, 600)
}

const LANG_LABELS = {
  java:    'Java',
  node:    'Node.js',
  python:  'Python',
  go:      'Go',
  ruby:    'Ruby',
  php:     'PHP',
  rust:    'Rust',
  dotnet:  '.NET',
  elixir:  'Elixir',
  generic: 'HTTP',
}

const langLabel = computed(() => LANG_LABELS[props.service.language] ?? props.service.language)

const rowStatusClass = computed(() => {
  const s = props.result?.status
  if (s === 'up')   return 'row-up'
  if (s === 'down') return 'row-down'
  if (s === 'warn') return 'row-warn'
  return 'row-unknown'
})

const badgeStatusClass = computed(() => {
  const s = props.result?.status
  if (s === 'up')   return 'badge-up'
  if (s === 'down') return 'badge-down'
  if (s === 'warn') return 'badge-warn'
  return 'badge-unknown'
})

const statusLabel = computed(() => {
  const s = props.result?.status
  if (s === 'up')   return 'UP'
  if (s === 'down') return 'DOWN'
  if (s === 'warn') return 'WARN'
  return '—'
})

const latencyClass = computed(() => {
  const ms = props.result?.latency
  if (ms === null || ms === undefined) return 'lat-muted'
  if (ms < 200)  return 'lat-up'
  if (ms < 800)  return 'lat-warn'
  return 'lat-down'
})

const latencyLabel = computed(() => {
  const ms = props.result?.latency
  if (ms === null || ms === undefined) return '—'
  return `${ms}ms`
})

const BUCKET_SIZE     = 12  // 12 polls × 5 min = 1h per bucket
const DISPLAY_BUCKETS = 24  // 24 hours

const hourlyHistory = computed(() => {
  const hist = props.result?.history ?? []
  const buckets = []
  for (let i = 0; i < hist.length; i += BUCKET_SIZE) {
    const slice = hist.slice(i, i + BUCKET_SIZE)
    if      (slice.includes('down'))    buckets.push('down')
    else if (slice.includes('warn'))    buckets.push('warn')
    else if (slice.includes('up'))      buckets.push('up')
    else if (slice.includes('unknown')) buckets.push('unknown')
    else                                buckets.push('empty')
  }
  const padCount = Math.max(0, DISPLAY_BUCKETS - buckets.length)
  return [...Array(padCount).fill('empty'), ...buckets]
})
</script>

<style scoped>
.service-row {
  display: grid;
  grid-template-columns: 190px 84px 100px 64px 88px 1fr 68px;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}

.service-row:last-child {
  border-bottom: none;
}

.service-row:hover {
  background: var(--surface2);
}

/* --- 1. Service name --- */
.svc-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 8px;
}

/* --- 2. Language badge --- */
.lang-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  font-family: 'Syne', sans-serif;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 7px;
  border-radius: 4px;
  white-space: nowrap;
}

.lang-java {
  background: rgba(249, 115, 22, 0.15);
  color: #fb923c;
  border: 1px solid rgba(249, 115, 22, 0.28);
}

.lang-node {
  background: rgba(234, 179, 8, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(234, 179, 8, 0.28);
}

.lang-python {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  border: 1px solid rgba(99, 102, 241, 0.28);
}

.lang-go {
  background: rgba(6, 182, 212, 0.15);
  color: #22d3ee;
  border: 1px solid rgba(6, 182, 212, 0.28);
}

.lang-ruby {
  background: rgba(220, 38, 38, 0.15);
  color: #f87171;
  border: 1px solid rgba(220, 38, 38, 0.28);
}

.lang-php {
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.28);
}

.lang-rust {
  background: rgba(234, 88, 12, 0.15);
  color: #fb923c;
  border: 1px solid rgba(234, 88, 12, 0.28);
}

.lang-dotnet {
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.28);
}

.lang-elixir {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.28);
}

.lang-generic {
  background: rgba(100, 116, 139, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.28);
}

/* --- 3. Status badge --- */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--muted);
}

/* Dot colors via parent row class */
.row-up   .status-dot { background: var(--up);   box-shadow: 0 0 6px var(--up); }
.row-down .status-dot { background: var(--down); box-shadow: 0 0 6px var(--down); }
.row-warn .status-dot { background: var(--warn); box-shadow: 0 0 6px var(--warn); }

/* Badge text color via badge class */
.badge-up      { color: var(--up); }
.badge-down    { color: var(--down); }
.badge-warn    { color: var(--warn); }
.badge-unknown { color: var(--muted); }

/* --- 4. HTTP code --- */
.http-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--muted);
}

/* --- 5. Latency --- */
.latency {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  text-align: right;
  padding-right: 14px;
}

.lat-up    { color: var(--up); }
.lat-warn  { color: var(--warn); }
.lat-down  { color: var(--down); }
.lat-muted { color: var(--muted); }

/* --- 6. Sparkbar --- */
.sparkbar {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow: hidden;
}

.spark-seg {
  width: 8px;
  height: 20px;
  border-radius: 3px;
  flex-shrink: 0;
}

.spark-up      { background: var(--up);   opacity: 0.75; }
.spark-warn    { background: var(--warn); opacity: 0.85; }
.spark-down    { background: var(--down); opacity: 0.9; }
.spark-unknown { background: var(--border2); opacity: 0.5; }
.spark-empty   { background: var(--border);  opacity: 0.35; }

/* --- 7. Check button --- */
.check-btn {
  justify-self: end;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  padding: 4px 10px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 4px;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.check-btn:hover {
  color: var(--blue);
  border-color: var(--blue);
}

.check-btn.flash {
  color: var(--blue);
  background: rgba(0, 150, 199, 0.15);
  border-color: var(--blue);
  transition: none;
}
</style>
