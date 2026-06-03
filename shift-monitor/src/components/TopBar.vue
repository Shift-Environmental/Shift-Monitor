<template>
  <header class="topbar">
    <div class="topbar-left">
      <div class="logo">
        <img
          src="https://images.squarespace-cdn.com/content/v1/6a02b422e7098049073dc81e/09b49f60-b51a-43a3-98f3-d792932fc98a/Horizontal+Shift+Logo+Reversed.png?format=750w"
          alt="Shift Coastal Technologies"
          class="logo-img"
        />
        <span class="logo-divider">/</span>
        <span class="logo-product">monitor</span>
      </div>
      <span class="polling-dot" :class="{ active: isPolling }"></span>
      <span v-if="!proxyOnline" class="proxy-warn" title="The proxy server isn't running. Start it with: node server.js">
        ⚠ proxy offline
      </span>
    </div>

    <div class="topbar-right">
      <span class="server-count">{{ serverCount }} {{ serverCount === 1 ? 'server' : 'servers' }}</span>

      <span v-if="lastPolled" class="last-polled">
        Last polled:&nbsp;
        <time :datetime="lastPolled.toISOString()">{{ formattedTime }}</time>
      </span>

      <button class="refresh-btn" :disabled="isPolling" @click="$emit('refresh')" title="Poll all servers now">
        <span class="refresh-icon" :class="{ spinning: isPolling }">↻</span>
        Refresh
      </button>

      <button class="add-btn" @click="$emit('add-server')" title="Add a new server">
        + Add Server
      </button>

      <button class="icon-action-btn" title="Export servers to JSON" @click="$emit('export')">
        ↓ Export
      </button>

      <label class="icon-action-btn" title="Import servers from JSON">
        ↑ Import
        <input type="file" accept=".json,application/json" class="hidden-file" @change="onImportFile" />
      </label>

      <button class="theme-btn" :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme">
        <span v-if="theme === 'dark'">☀</span>
        <span v-else>☾</span>
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useTheme } from '../useTheme.js'

const props = defineProps({
  lastPolled:   { type: Date,    default: null },
  isPolling:    { type: Boolean, required: true },
  proxyOnline:  { type: Boolean, default: true },
  serverCount:  { type: Number,  default: 0 },
})

const emit = defineEmits(['refresh', 'add-server', 'export', 'import'])

const { theme, toggleTheme } = useTheme()

function onImportFile(e) {
  const file = e.target.files[0]
  if (file) emit('import', file)
  e.target.value = ''
}

const formattedTime = computed(() => {
  if (!props.lastPolled) return ''
  return props.lastPolled.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
})
</script>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: #182030;
  border-bottom: 1px solid #2c3d56;
  flex-shrink: 0;
  gap: 12px;
  /* Always-dark overrides so buttons/text look right regardless of page theme */
  --surface2: #1f2a3e;
  --border:   #2c3d56;
  --border2:  #3a5068;
  --text:     #e3e9f0;
  --muted:    #7d90a4;
  --blue:     #0096c7;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.logo-img {
  height: 22px;
  width: auto;
  display: block;
}

.logo-divider {
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  color: var(--border2);
  font-weight: 400;
  line-height: 1;
}

.logo-product {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  letter-spacing: 0.04em;
  line-height: 1;
}

.polling-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--muted);
  transition: background 0.3s;
  flex-shrink: 0;
}

.polling-dot.active {
  background: var(--blue);
  box-shadow: 0 0 6px var(--blue);
  animation: topbar-blink 1s ease-in-out infinite;
}

@keyframes topbar-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.2; }
}

.proxy-warn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--warn);
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: default;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.server-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

.last-polled {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

.last-polled time {
  color: var(--text);
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 6px;
  color: var(--text);
  font-family: 'Syne', sans-serif;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--border);
  border-color: var(--blue);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.refresh-icon {
  font-size: 16px;
  display: inline-block;
  line-height: 1;
}

.refresh-icon.spinning {
  animation: topbar-spin 1s linear infinite;
}

@keyframes topbar-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--blue);
  border: 1px solid var(--blue);
  border-radius: 6px;
  color: #fff;
  font-family: 'Syne', sans-serif;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.add-btn:hover {
  opacity: 0.85;
}

.icon-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 6px;
  color: var(--muted);
  font-family: 'Syne', sans-serif;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: color 0.15s, border-color 0.15s;
}

.icon-action-btn:hover {
  color: var(--text);
  border-color: var(--blue);
}

.hidden-file {
  display: none;
}

.theme-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 6px;
  color: var(--muted);
  font-size: 15px;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.theme-btn:hover {
  color: var(--text);
  border-color: var(--blue);
}
</style>
