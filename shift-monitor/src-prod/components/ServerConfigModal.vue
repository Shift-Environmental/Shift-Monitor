<template>
  <div class="overlay" @mousedown.self="$emit('close')">
    <div class="modal" role="dialog" aria-modal="true" :aria-label="isEdit ? 'Edit server' : 'Add server'">

      <!-- header -->
      <div class="modal-header">
        <h2>{{ isEdit ? 'Edit Server' : 'Add Server' }}</h2>
        <button class="close-btn" @click="$emit('close')" aria-label="Close">✕</button>
      </div>

      <!-- body -->
      <div class="modal-body">

        <!-- ── Server details ── -->
        <section class="form-section">
          <div class="field-grid">

            <label class="field">
              <span class="field-label">Name</span>
              <input
                v-model="form.name"
                type="text"
                placeholder="prod-web-1"
                class="input"
                :class="{ error: touched.name && !form.name.trim() }"
                @blur="touched.name = true"
              />
            </label>

            <label class="field">
              <span class="field-label">Region</span>
              <input v-model="form.region" type="text" placeholder="ca-west-1" class="input" />
            </label>

            <label class="field field-host">
              <span class="field-label">Host / IP</span>
              <div class="host-row">
                <input
                  v-model="form.privateIp"
                  type="text"
                  placeholder="172.31.1.10  or  api.example.com"
                  class="input mono"
                  :class="{ error: touched.privateIp && !validHost }"
                  @blur="touched.privateIp = true"
                  @keydown.enter.prevent="detectServices"
                />
                <button
                  class="detect-btn"
                  :class="{ loading: detecting }"
                  :disabled="!validHost || detecting"
                  title="Probe this host for running services"
                  @click="detectServices"
                >
                  {{ detecting ? '⟳ Scanning…' : '⌕ Detect' }}
                </button>
              </div>
              <span v-if="touched.privateIp && !validHost" class="field-error">Enter a valid IP or hostname</span>
              <span v-else-if="detectStatus === 'found'" class="field-hint found">
                ✓ {{ form.services.length }} service{{ form.services.length !== 1 ? 's' : '' }} detected
              </span>
              <span v-else-if="detectStatus === 'empty'" class="field-hint warn">
                ⚠ Nothing responded — add services manually below
              </span>
              <span v-else-if="detectStatus === 'error'" class="field-hint warn">
                ⚠ Scan failed — check host is reachable from the monitor
              </span>
              <span v-else class="field-hint">IP or hostname the monitor can reach — click Detect to auto-discover services</span>
            </label>

            <label class="field">
              <span class="field-label">SSH User</span>
              <input v-model="form.sshUser" type="text" placeholder="ec2-user" class="input mono" />
              <span v-if="form.privateIp" class="field-hint mono">
                ssh {{ form.sshUser || 'ec2-user' }}@{{ form.privateIp }}
              </span>
            </label>

          </div>
        </section>

        <!-- ── Services ── -->
        <section class="form-section">
          <div class="section-header-row">
            <h3 class="section-title">Services</h3>
            <button class="add-svc-btn" @click="addService">+ Add service</button>
          </div>

          <div v-if="form.services.length === 0" class="empty-services">
            <p>No services yet.</p>
            <p v-if="validHost">Enter the host above and click <strong>Detect</strong> to auto-discover, or add manually.</p>
            <p v-else>Enter the host above, then detect or add services manually.</p>
          </div>

          <div v-else class="svc-list">
            <div class="svc-cols-header">
              <span>Name</span>
              <span>Language</span>
              <span>Port</span>
              <span>Health path</span>
              <span></span>
            </div>

            <div v-for="(svc, i) in form.services" :key="i" class="svc-card">
              <div class="svc-cols">
                <input v-model="svc.name" type="text" placeholder="my-api" class="input svc-input" />
                <select v-model="svc.language" class="input svc-select" @change="autoPath(svc)">
                  <option value="node">Node.js</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="go">Go</option>
                  <option value="ruby">Ruby</option>
                  <option value="php">PHP</option>
                  <option value="rust">Rust</option>
                  <option value="dotnet">.NET</option>
                  <option value="elixir">Elixir</option>
                  <option value="generic">Generic / HTTP</option>
                </select>
                <input v-model.number="svc.port" type="number" placeholder="8080" min="1" max="65535" class="input svc-port mono" />
                <input v-model="svc.healthPath" type="text" :placeholder="HEALTH_PATHS[svc.language]" class="input svc-path mono" />
                <button class="remove-svc" @click="removeService(i)" aria-label="Remove">✕</button>
              </div>

              <div class="url-row">
                <span class="url-label">Check URL</span>
                <input
                  v-model="svc.checkUrl"
                  type="text"
                  placeholder="Leave blank to auto-build from host + port + path above"
                  class="input mono url-input"
                />
              </div>

              <div class="url-preview">
                <span class="url-label">Will check:</span>
                <code class="url-text" :class="{ 'url-override': svc.checkUrl }">{{ urlPreview(svc) }}</code>
                <span v-if="svc.version" class="detected-version">{{ svc.version }}</span>
              </div>
            </div>
          </div>
        </section>

      </div>

      <!-- footer -->
      <div class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">Cancel</button>
        <button class="btn-save" :disabled="!canSave" @click="save">
          {{ isEdit ? 'Save Changes' : 'Add Server' }}
        </button>
      </div>
    </div>
  </div>

  <ConfirmDialog
    v-if="pendingRemoveIndex !== null"
    :message="`Remove service '${form.services[pendingRemoveIndex]?.name || 'this service'}'?`"
    confirm-label="Remove"
    @confirm="doRemoveService"
    @cancel="pendingRemoveIndex = null"
  />
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { HEALTH_PATHS } from '../useServers.js'
import ConfirmDialog from './ConfirmDialog.vue'

const props = defineProps({
  server: { type: Object, default: null },
})

const emit = defineEmits(['close', 'save'])

const isEdit = computed(() => !!props.server)

const form = reactive({
  id:        '',
  name:      '',
  privateIp: '',
  region:    '',
  sshUser:   'admin',
  services:  [],
})

const touched      = reactive({ name: false, privateIp: false })
const detecting    = ref(false)
const detectStatus = ref(null)  // null | 'found' | 'empty' | 'error'

onMounted(() => {
  if (props.server) {
    form.id        = props.server.id
    form.name      = props.server.name
    form.privateIp = props.server.privateIp
    form.region    = props.server.region  ?? ''
    form.sshUser   = props.server.sshUser ?? 'admin'
    form.services  = props.server.services.map((s) => ({ checkUrl: '', ...s }))
  }
})

const validHost = computed(() => {
  const v = form.privateIp.trim()
  if (!v) return false
  const ipParts = v.split('.')
  if (ipParts.length === 4 && ipParts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return true
  return /^[a-zA-Z0-9]([a-zA-Z0-9\-.]*[a-zA-Z0-9])?$/.test(v)
})

const canSave = computed(() =>
  form.name.trim() &&
  validHost.value &&
  form.services.every((s) => s.name.trim() && s.port > 0 && s.port <= 65535)
)

async function detectServices() {
  if (!validHost.value || detecting.value) return
  detecting.value    = true
  detectStatus.value = null
  try {
    const res   = await fetch('/api/detect', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ host: form.privateIp.trim() }),
    })
    const found = await res.json()
    if (Array.isArray(found) && found.length > 0) {
      form.services      = found.map((s) => ({ checkUrl: '', ...s }))
      detectStatus.value = 'found'
    } else {
      detectStatus.value = 'empty'
    }
  } catch {
    detectStatus.value = 'error'
  } finally {
    detecting.value = false
  }
}

function addService() {
  form.services.push({ name: '', language: 'node', port: 3000, healthPath: HEALTH_PATHS.node, checkUrl: '' })
}

const pendingRemoveIndex = ref(null)

function removeService(i)  { pendingRemoveIndex.value = i }
function doRemoveService() {
  if (pendingRemoveIndex.value !== null) {
    form.services.splice(pendingRemoveIndex.value, 1)
    pendingRemoveIndex.value = null
  }
}

function autoPath(svc)  { svc.healthPath = HEALTH_PATHS[svc.language] ?? '/health' }

function urlPreview(svc) {
  if (svc.checkUrl) return svc.checkUrl
  if (!form.privateIp || !svc.port) return '—'
  const path = svc.healthPath || HEALTH_PATHS[svc.language] || '/health'
  return `http://${form.privateIp}:${svc.port}${path}`
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

function save() {
  if (!canSave.value) return
  emit('save', {
    id:        form.id || uid(),
    name:      form.name.trim(),
    privateIp: form.privateIp.trim(),
    region:    form.region.trim(),
    sshUser:   form.sshUser.trim() || 'admin',
    services:  form.services.map((s) => ({
      name:       s.name.trim(),
      language:   s.language,
      port:       Number(s.port),
      healthPath: s.healthPath || HEALTH_PATHS[s.language],
      ...(s.checkUrl?.trim() ? { checkUrl: s.checkUrl.trim() } : {}),
    })),
  })
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 12px;
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.modal-header h2 {
  font-family: 'Syne', sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.close-btn {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: color 0.15s;
}

.close-btn:hover { color: var(--text); }

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-section { display: flex; flex-direction: column; gap: 12px; }

.section-title {
  font-family: 'Syne', sans-serif;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.field-host { grid-column: 1 / -1; }

.field { display: flex; flex-direction: column; gap: 5px; }

.field-label {
  font-family: 'Syne', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.field-error { font-size: 11px; color: var(--down); }

.field-hint { font-size: 11px; color: var(--muted); }
.field-hint.found { color: var(--up); }
.field-hint.warn  { color: var(--warn); }
.field-hint.mono  { font-family: 'JetBrains Mono', monospace; }

.host-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.host-row .input { flex: 1; }

.detect-btn {
  font-family: 'Syne', sans-serif;
  font-size: 12px;
  font-weight: 700;
  padding: 7px 14px;
  background: rgba(0, 150, 199, 0.1);
  border: 1px solid rgba(0, 150, 199, 0.35);
  border-radius: 6px;
  color: var(--blue);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, opacity 0.15s;
  flex-shrink: 0;
}

.detect-btn:hover:not(:disabled) { background: rgba(0, 150, 199, 0.18); }
.detect-btn:disabled { opacity: 0.45; cursor: default; }

.input {
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 6px;
  color: var(--text);
  font-family: 'Syne', sans-serif;
  font-size: 13px;
  padding: 7px 10px;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}

.input:focus  { border-color: var(--blue); }
.input.error  { border-color: var(--down); }
.input.mono   { font-family: 'JetBrains Mono', monospace; }

.empty-services {
  padding: 24px 16px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  background: var(--surface2);
  border: 1px dashed var(--border2);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.empty-services strong { color: var(--blue); }

.add-svc-btn {
  font-family: 'Syne', sans-serif;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  background: rgba(0, 150, 199, 0.1);
  border: 1px solid rgba(0, 150, 199, 0.35);
  border-radius: 6px;
  color: var(--blue);
  cursor: pointer;
  transition: background 0.15s;
}

.add-svc-btn:hover { background: rgba(0, 150, 199, 0.18); }

.svc-list { display: flex; flex-direction: column; gap: 8px; }

.svc-cols-header {
  display: grid;
  grid-template-columns: 1fr 110px 80px 160px 28px;
  gap: 8px;
  padding: 0 4px;
  font-family: 'Syne', sans-serif;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.svc-card {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.svc-cols {
  display: grid;
  grid-template-columns: 1fr 110px 80px 160px 28px;
  gap: 8px;
  align-items: center;
}

.svc-port { text-align: right; }

.remove-svc {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
  justify-self: center;
}

.remove-svc:hover {
  color: var(--down);
  background: rgba(239, 68, 68, 0.1);
}

.url-row { display: flex; align-items: center; gap: 8px; }
.url-input { flex: 1; font-size: 11px; padding: 5px 8px; }

.url-preview { display: flex; align-items: center; gap: 8px; }

.url-label {
  font-family: 'Syne', sans-serif;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  flex-shrink: 0;
}

.url-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.url-text.url-override { color: var(--blue); }

.detected-version {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--up);
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.25);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.btn-cancel {
  padding: 7px 16px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 6px;
  color: var(--muted);
  font-family: 'Syne', sans-serif;
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s;
}

.btn-cancel:hover { color: var(--text); }

.btn-save {
  padding: 7px 20px;
  background: var(--blue);
  border: 1px solid var(--blue);
  border-radius: 6px;
  color: #fff;
  font-family: 'Syne', sans-serif;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-save:not(:disabled):hover { opacity: 0.85; }

.modal-body::-webkit-scrollbar        { width: 5px; }
.modal-body::-webkit-scrollbar-track  { background: transparent; }
.modal-body::-webkit-scrollbar-thumb  { background: var(--border2); border-radius: 3px; }
</style>
