<template>
  <div class="service-row" :class="rowStatusClass">
    <!-- 1. Service name -->
    <span class="svc-name" :title="service.name">
      <i class="mdi" :class="langIcon" :title="langLabel"></i>
      {{ service.name }}
    </span>

    <!-- 2. Status pill -->
    <span class="status-pill" :class="pillClass">
      <i class="mdi" :class="statusIcon"></i>
      {{ statusLabel }}
    </span>

    <!-- 3. HTTP status code -->
    <span class="http-code" :class="codeClass">{{ result?.code ?? '—' }}</span>

    <!-- 4. Latency -->
    <span class="latency" :class="latencyClass">{{ latencyLabel }}</span>

    <!-- 5. Version -->
    <span class="version-badge" :class="{ 'version-empty': !result?.version }">
      {{ result?.version ?? '—' }}
    </span>

    <!-- 6. Sparkbar — 24 hourly buckets = 24h -->
    <span class="sparkbar" aria-label="24-hour history">
      <span
        v-for="(entry, i) in hourlyHistory"
        :key="i"
        class="spark-seg"
        :class="`spark-${entry}`"
      ></span>
    </span>

    <!-- 6. Manual check button -->
    <button
      class="check-btn"
      :class="{ flash: flashing }"
      title="Check now"
      @click="handleCheck"
    >
      <i class="mdi mdi-refresh"></i>
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
  setTimeout(() => { flashing.value = false }, 600)
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

const LANG_ICONS = {
  java:    'mdi-language-java',
  node:    'mdi-nodejs',
  python:  'mdi-language-python',
  go:      'mdi-language-go',
  ruby:    'mdi-language-ruby',
  php:     'mdi-language-php',
  rust:    'mdi-language-rust',
  dotnet:  'mdi-dot-net',
  elixir:  'mdi-code-braces',
  generic: 'mdi-web',
}

const langLabel = computed(() => LANG_LABELS[props.service.language] ?? props.service.language)
const langIcon  = computed(() => LANG_ICONS[props.service.language]  ?? 'mdi-code-braces')

const rowStatusClass = computed(() => {
  const s = props.result?.status
  if (s === 'down') return 'row-down'
  if (s === 'warn') return 'row-warn'
  return ''
})

const pillClass = computed(() => {
  const s = props.result?.status
  if (s === 'up')   return 'pill-up'
  if (s === 'down') return 'pill-down'
  if (s === 'warn') return 'pill-warn'
  return 'pill-unknown'
})

const statusIcon = computed(() => {
  const s = props.result?.status
  if (s === 'up')   return 'mdi-check-circle'
  if (s === 'down') return 'mdi-close-circle'
  if (s === 'warn') return 'mdi-alert'
  return 'mdi-help-circle-outline'
})

const statusLabel = computed(() => {
  const s = props.result?.status
  if (s === 'up')   return 'UP'
  if (s === 'down') return 'DOWN'
  if (s === 'warn') return 'WARN'
  return '—'
})

const codeClass = computed(() => {
  const c = props.result?.code
  if (!c) return 'code-muted'
  if (c >= 200 && c < 300) return 'code-ok'
  if (c >= 400 && c < 500) return 'code-warn'
  return 'code-err'
})

const latencyClass = computed(() => {
  const ms = props.result?.latency
  if (ms === null || ms === undefined) return 'lat-muted'
  if (ms < 200) return 'lat-up'
  if (ms < 800) return 'lat-warn'
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
  const hist    = props.result?.history ?? []
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
  grid-template-columns: minmax(140px, 2fr) 90px 56px 76px 64px 1fr 38px;
  align-items: center;
  padding: 9px 16px;
  border-bottom: 1px solid var(--border);
  gap: 8px;
  transition: background 0.15s;
}

.service-row:last-child { border-bottom: none; }
.service-row:hover      { background: var(--surface2); }

.row-down { background: rgba(239, 68, 68, 0.06); }
.row-warn { background: rgba(245, 158, 11, 0.06); }
.row-down:hover { background: rgba(239, 68, 68, 0.12); }
.row-warn:hover { background: rgba(245, 158, 11, 0.10); }

/* 1. Service name */
.svc-name {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.svc-name .mdi {
  font-size: 15px;
  color: var(--muted);
  flex-shrink: 0;
}

/* 2. Status pill */
.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 20px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.status-pill .mdi { font-size: 13px; }

.pill-up {
  background: rgba(34, 197, 94, 0.12);
  color: var(--up);
  border: 1px solid rgba(34, 197, 94, 0.28);
}

.pill-down {
  background: rgba(239, 68, 68, 0.12);
  color: var(--down);
  border: 1px solid rgba(239, 68, 68, 0.28);
}

.pill-warn {
  background: rgba(245, 158, 11, 0.12);
  color: var(--warn);
  border: 1px solid rgba(245, 158, 11, 0.28);
}

.pill-unknown {
  background: rgba(125, 144, 164, 0.08);
  color: var(--muted);
  border: 1px solid rgba(125, 144, 164, 0.2);
}

/* 3. HTTP code */
.http-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  text-align: center;
}

.code-ok   { color: var(--up); }
.code-warn { color: var(--warn); }
.code-err  { color: var(--down); }
.code-muted { color: var(--muted); }

/* 4. Latency */
.latency {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  text-align: right;
}

.lat-up    { color: var(--up); }
.lat-warn  { color: var(--warn); }
.lat-down  { color: var(--down); }
.lat-muted { color: var(--muted); }

/* 5. Sparkbar */
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

.spark-up      { background: var(--up);      opacity: 0.8; }
.spark-warn    { background: var(--warn);    opacity: 0.9; }
.spark-down    { background: var(--down);    opacity: 0.95; }
.spark-unknown { background: var(--border2); opacity: 0.5; }
.spark-empty   { background: var(--border);  opacity: 0.3; }

/* 5. Version badge */
.version-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0, 150, 199, 0.1);
  color: var(--blue);
  border: 1px solid rgba(0, 150, 199, 0.25);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.version-empty {
  background: transparent;
  border-color: transparent;
  color: var(--muted);
}

/* 7. Check button */
.check-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: transparent;
  border: 1px solid var(--border2);
  border-radius: 6px;
  color: var(--muted);
  font-size: 16px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  justify-self: end;
}

.check-btn:hover {
  color: var(--blue);
  border-color: var(--blue);
  background: rgba(0, 150, 199, 0.08);
}

.check-btn.flash {
  color: var(--blue);
  background: rgba(0, 150, 199, 0.18);
  border-color: var(--blue);
  transition: none;
}
</style>
