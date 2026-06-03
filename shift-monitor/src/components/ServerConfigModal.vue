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
          <h3 class="section-title">Server Details</h3>
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
              <span class="field-label">Host</span>
              <input
                v-model="form.privateIp"
                type="text"
                placeholder="10.0.1.42 or 3.87.172.0"
                class="input mono"
                :class="{ error: touched.privateIp && !validIp }"
                @blur="touched.privateIp = true"
              />
              <span v-if="touched.privateIp && !validIp" class="field-error">
                Enter a valid IPv4 address
              </span>
              <span v-else class="field-hint">IP reachable from where shift/monitor runs — private IP if on same network, public IP if remote</span>
            </label>
            <label class="field">
              <span class="field-label">Region</span>
              <input
                v-model="form.region"
                type="text"
                placeholder="us-east-1"
                class="input"
              />
            </label>
            <label class="field">
              <span class="field-label">SSH User</span>
              <input
                v-model="form.sshUser"
                type="text"
                placeholder="ec2-user"
                class="input mono"
              />
              <span class="field-hint">Used to generate the connect command</span>
            </label>
          </div>

          <!-- SSH preview -->
          <div v-if="form.privateIp" class="ssh-preview">
            <span class="ssh-label">Connect:</span>
            <code class="ssh-cmd">ssh {{ form.sshUser || 'ec2-user' }}@{{ form.privateIp }}</code>
          </div>
        </section>

        <!-- ── Services ── -->
        <section class="form-section">
          <div class="section-header-row">
            <h3 class="section-title">Services</h3>
            <button class="add-svc-btn" @click="addService">+ Add Service</button>
          </div>

          <div v-if="form.services.length === 0" class="empty-services">
            No services yet. Click "+ Add Service" to add one.
          </div>

          <div v-else class="svc-list">
            <!-- column headers -->
            <div class="svc-cols-header">
              <span>Name</span>
              <span>Language</span>
              <span>Port</span>
              <span>Health Path</span>
              <span></span>
            </div>

            <div v-for="(svc, i) in form.services" :key="i" class="svc-card">
              <div class="svc-cols">
                <input
                  v-model="svc.name"
                  type="text"
                  placeholder="api-gateway"
                  class="input svc-input"
                />
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
                <input
                  v-model.number="svc.port"
                  type="number"
                  placeholder="8080"
                  min="1"
                  max="65535"
                  class="input svc-port mono"
                />
                <input
                  v-model="svc.healthPath"
                  type="text"
                  :placeholder="HEALTH_PATHS[svc.language]"
                  class="input svc-path mono"
                />
                <button class="remove-svc" @click="removeService(i)" aria-label="Remove service">
                  ✕
                </button>
              </div>

              <!-- derived URL preview -->
              <div class="url-preview">
                <span class="url-label">URL:</span>
                <code class="url-text">{{ urlPreview(svc) }}</code>
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
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { HEALTH_PATHS } from '../useServers.js'

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
  sshUser:   'ec2-user',
  services:  [],
})

const touched = reactive({ name: false, privateIp: false })

// Pre-fill form when editing an existing server.
onMounted(() => {
  if (props.server) {
    form.id        = props.server.id
    form.name      = props.server.name
    form.privateIp = props.server.publicIp || props.server.privateIp
    form.region    = props.server.region   ?? ''
    form.sshUser   = props.server.sshUser   ?? 'ec2-user'
    form.services  = props.server.services.map((s) => ({ ...s }))
  }
})

// Loose IPv4 validation — accepts any dotted-quad that looks reasonable.
const validIp = computed(() => {
  const v = form.privateIp.trim()
  if (!v) return false
  const parts = v.split('.')
  if (parts.length !== 4) return false
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
})

const canSave = computed(() => {
  return (
    form.name.trim() &&
    validIp.value &&
    form.services.length > 0 &&
    form.services.every((s) => s.name.trim() && s.port > 0 && s.port <= 65535)
  )
})

function addService() {
  form.services.push({
    name:       '',
    language:   'node',
    port:       3000,
    healthPath: HEALTH_PATHS.node,
  })
}

function removeService(i) {
  form.services.splice(i, 1)
}

function autoPath(svc) {
  svc.healthPath = HEALTH_PATHS[svc.language] ?? '/health'
}

function urlPreview(svc) {
  if (!form.privateIp || !svc.port) return '—'
  const host = form.privateIp
  const path = svc.healthPath || HEALTH_PATHS[svc.language] || '/health'
  return `http://${host}:${svc.port}${path}`
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function save() {
  if (!canSave.value) return
  emit('save', {
    id:        form.id || uid(),
    name:      form.name.trim(),
    privateIp: form.privateIp.trim(),
    region:    form.region.trim(),
    sshUser:   form.sshUser.trim() || 'ec2-user',
    services:  form.services.map((s) => ({
      name:       s.name.trim(),
      language:   s.language,
      port:       Number(s.port),
      healthPath: s.healthPath || HEALTH_PATHS[s.language],
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
  max-width: 680px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* header */
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
  transition: color 0.15s, background 0.15s;
}

.close-btn:hover {
  color: var(--text);
  background: var(--surface2);
}

/* body */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

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

/* fields */
.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-label {
  font-family: 'Syne', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.field-error {
  font-size: 11px;
  color: var(--down);
}

.field-optional {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--muted);
  opacity: 0.7;
}

.field-hint {
  font-size: 11px;
  color: var(--muted);
}

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
}

.input:focus {
  border-color: var(--blue);
}

.input.error {
  border-color: var(--down);
}

.input.mono {
  font-family: 'JetBrains Mono', monospace;
}

/* SSH preview */
.ssh-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.ssh-label {
  font-family: 'Syne', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.ssh-cmd {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--blue);
}

/* add service button */
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

.add-svc-btn:hover {
  background: rgba(0, 150, 199, 0.18);
}

.empty-services {
  font-size: 13px;
  color: var(--muted);
  padding: 16px 0;
  text-align: center;
}

/* services list */
.svc-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.svc-cols-header {
  display: grid;
  grid-template-columns: 1fr 100px 80px 160px 28px;
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
  grid-template-columns: 1fr 100px 80px 160px 28px;
  gap: 8px;
  align-items: center;
}

.svc-input  { }
.svc-select { cursor: pointer; }
.svc-port   { text-align: right; }
.svc-path   { }

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

.url-preview {
  display: flex;
  align-items: center;
  gap: 8px;
}

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

/* footer */
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
  transition: color 0.15s, border-color 0.15s;
}

.btn-cancel:hover {
  color: var(--text);
  border-color: var(--border2);
}

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

.btn-save:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-save:not(:disabled):hover {
  opacity: 0.85;
}

/* scrollbar inside modal */
.modal-body::-webkit-scrollbar        { width: 5px; }
.modal-body::-webkit-scrollbar-track  { background: transparent; }
.modal-body::-webkit-scrollbar-thumb  { background: var(--border2); border-radius: 3px; }
</style>
