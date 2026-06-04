<template>
  <div class="summary-bar">
    <div class="tile">
      <i class="mdi mdi-check-circle tile-icon color-up"></i>
      <div class="tile-text">
        <span class="tile-value color-up">{{ summary.up }}</span>
        <span class="tile-label">Up</span>
      </div>
    </div>
    <div class="divider"></div>
    <div class="tile">
      <i class="mdi mdi-close-circle tile-icon color-down"></i>
      <div class="tile-text">
        <span class="tile-value color-down">{{ summary.down }}</span>
        <span class="tile-label">Down</span>
      </div>
    </div>
    <div class="divider"></div>
    <div class="tile">
      <i class="mdi mdi-alert tile-icon color-warn"></i>
      <div class="tile-text">
        <span class="tile-value color-warn">{{ summary.warn }}</span>
        <span class="tile-label">Degraded</span>
      </div>
    </div>
    <div class="divider"></div>
    <div class="tile">
      <i class="mdi mdi-speedometer tile-icon" :class="avgLatencyColor"></i>
      <div class="tile-text">
        <span class="tile-value" :class="avgLatencyColor">
          {{ summary.avgLatency !== null ? summary.avgLatency + 'ms' : '—' }}
        </span>
        <span class="tile-label">Avg Response</span>
      </div>
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
  if (ms === null) return 'color-muted'
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
  border-radius: 10px;
  margin-bottom: 20px;
  overflow: hidden;
}

.tile {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 12px;
}

.tile-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.tile-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.divider {
  width: 1px;
  background: var(--border);
  align-self: stretch;
  flex-shrink: 0;
}

.tile-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 26px;
  font-weight: 600;
  line-height: 1;
  color: var(--text);
}

.color-up   { color: var(--up); }
.color-down { color: var(--down); }
.color-warn { color: var(--warn); }
.color-muted { color: var(--muted); }

.tile-label {
  font-family: 'Syne', sans-serif;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

@media (max-width: 600px) {
  .tile { padding: 12px 8px; gap: 8px; }
  .tile-icon { font-size: 22px; }
  .tile-value { font-size: 20px; }
}
</style>
