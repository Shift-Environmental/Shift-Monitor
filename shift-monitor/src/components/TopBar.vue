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

      <div class="topbar-meta">
        <span class="polling-dot" :class="{ active: isPolling }" :title="isPolling ? 'Polling…' : 'Idle'"></span>
        <span class="server-count">
          <i class="mdi mdi-server-network"></i>
          {{ serverCount }} {{ serverCount === 1 ? 'server' : 'servers' }}
        </span>
        <span v-if="lastPolled" class="last-polled">
          <i class="mdi mdi-clock-outline"></i>
          {{ formattedTime }}
        </span>
        <span v-if="!proxyOnline" class="proxy-warn">
          <i class="mdi mdi-alert"></i> proxy offline
        </span>
      </div>
    </div>

    <div class="topbar-right">
      <button class="btn-ghost" :disabled="isPolling" @click="$emit('refresh')" title="Poll all servers now">
        <i class="mdi mdi-refresh" :class="{ spinning: isPolling }"></i>
        <span class="btn-label">Refresh</span>
      </button>

      <button class="btn-primary" @click="$emit('add-server')" title="Add a new server">
        <i class="mdi mdi-plus"></i>
        <span class="btn-label">Add Server</span>
      </button>

      <button class="btn-icon" title="Export servers to JSON" @click="$emit('export')">
        <i class="mdi mdi-download"></i>
      </button>

      <label class="btn-icon" title="Import servers from JSON">
        <i class="mdi mdi-upload"></i>
        <input type="file" accept=".json,application/json" class="hidden-file" @change="onImportFile" />
      </label>

      <button class="btn-icon" :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme">
        <i class="mdi" :class="theme === 'dark' ? 'mdi-weather-sunny' : 'mdi-weather-night'"></i>
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
  padding: 0 20px;
  height: 54px;
  background: #182030;
  border-bottom: 1px solid #2c3d56;
  flex-shrink: 0;
  gap: 16px;
  box-sizing: border-box;
  --surface2: #1f2a3e;
  --border:   #2c3d56;
  --border2:  #3a5068;
  --text:     #e3e9f0;
  --muted:    #7d90a4;
  --blue:     #0096c7;
  --warn:     #f59e0b;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  min-width: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.logo-img { height: 20px; width: auto; display: block; }

.logo-divider {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #3a5068;
}

.logo-product {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  color: #7d90a4;
  letter-spacing: 0.04em;
}

.topbar-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.polling-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #3a5068;
  flex-shrink: 0;
  transition: background 0.3s;
}

.polling-dot.active {
  background: #0096c7;
  box-shadow: 0 0 6px #0096c7;
  animation: blink 1s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.2; }
}

.server-count,
.last-polled {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #7d90a4;
  white-space: nowrap;
}

.server-count .mdi,
.last-polled .mdi {
  font-size: 14px;
}

.proxy-warn {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--warn);
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 4px;
  padding: 2px 8px;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Ghost button (Refresh) */
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 6px;
  color: var(--text);
  font-family: 'Syne', sans-serif;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
}

.btn-ghost:hover:not(:disabled) {
  background: var(--border);
  border-color: var(--blue);
}

.btn-ghost:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-ghost .mdi { font-size: 16px; }

/* Primary button (Add Server) */
.btn-primary {
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
  transition: opacity 0.15s;
}

.btn-primary:hover { opacity: 0.85; }
.btn-primary .mdi { font-size: 16px; }

/* Icon-only button */
.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 6px;
  color: var(--muted);
  font-size: 18px;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s, border-color 0.15s;
}

.btn-icon:hover {
  color: var(--text);
  border-color: var(--blue);
}

.spinning { animation: spin 1s linear infinite; }

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.hidden-file { display: none; }

/* Responsive: hide text labels on small screens */
@media (max-width: 800px) {
  .btn-label { display: none; }
  .btn-ghost, .btn-primary { padding: 6px 10px; }
  .topbar-meta .last-polled { display: none; }
}

@media (max-width: 560px) {
  .topbar-meta .server-count { display: none; }
  .logo-product { display: none; }
}
</style>
