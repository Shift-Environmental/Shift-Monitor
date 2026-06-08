<template>
  <div class="summary-bar">
    <div class="tile">
      <span class="tile-value color-up">{{ summary.up }}</span>
      <span class="tile-label">Services Up</span>
    </div>
    <div class="divider" aria-hidden="true"></div>
    <div class="tile">
      <span class="tile-value color-down">{{ summary.down }}</span>
      <span class="tile-label">Services Down</span>
    </div>
    <div class="divider" aria-hidden="true"></div>
    <div class="tile">
      <span class="tile-value color-warn">{{ summary.warn }}</span>
      <span class="tile-label">Degraded</span>
    </div>
    <div class="divider" aria-hidden="true"></div>
    <div class="tile">
      <span class="tile-value" :class="avgLatencyColor">
        {{ summary.avgLatency !== null ? summary.avgLatency + 'ms' : '—' }}
      </span>
      <span class="tile-label">Avg Response</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  summary: { type: Object, required: true },
})

const avgLatencyColor = computed(() => {
  const ms = props.summary.avgLatency
  if (ms === null) return ''
  if (ms < 200) return 'color-up'
  if (ms < 800) return 'color-warn'
  return 'color-down'
})
</script>

<style scoped>
.summary-bar {
  display: flex;
  align-items: stretch;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
}

.tile {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 18px 12px;
  gap: 5px;
}

.divider {
  width: 1px;
  background: var(--border);
  align-self: stretch;
  flex-shrink: 0;
}

.tile-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 28px;
  font-weight: 600;
  line-height: 1;
  color: var(--text);
}

.color-up   { color: var(--up); }
.color-down { color: var(--down); }
.color-warn { color: var(--warn); }

.tile-label {
  font-family: 'Syne', sans-serif;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
</style>
