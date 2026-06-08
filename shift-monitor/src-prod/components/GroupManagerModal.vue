<template>
  <div class="overlay" @mousedown.self="$emit('close')">
    <div class="modal" role="dialog" aria-modal="true" aria-label="Manage groups">

      <div class="modal-header">
        <h2>Manage Groups</h2>
        <button class="close-btn" @click="$emit('close')" aria-label="Close">✕</button>
      </div>

      <div class="modal-body">

        <!-- existing groups -->
        <div v-if="groups.length > 0" class="groups-list">
          <div v-for="group in groups" :key="group.id" class="group-item">

            <!-- view mode -->
            <template v-if="editingId !== group.id">
              <div class="group-info">
                <span class="group-name">{{ group.name }}</span>
                <span class="group-count">{{ group.serverIds.length }} server{{ group.serverIds.length !== 1 ? 's' : '' }}</span>
              </div>
              <div class="group-actions">
                <button class="icon-btn" title="Edit group" @click="startEdit(group)">✎</button>
                <button class="icon-btn danger" title="Delete group" @click="deleteGroup(group.id)">✕</button>
              </div>
            </template>

            <!-- edit mode -->
            <template v-else>
              <div class="edit-form">
                <input
                  v-model="editForm.name"
                  type="text"
                  class="input"
                  placeholder="Group name"
                  @keydown.enter="saveEdit"
                  @keydown.esc="cancelEdit"
                />
                <p class="servers-label">Servers in this group</p>
                <div class="server-checklist">
                  <label v-for="srv in servers" :key="srv.id" class="server-check">
                    <input
                      type="checkbox"
                      :value="srv.id"
                      v-model="editForm.serverIds"
                    />
                    <span class="check-name">{{ srv.name }}</span>
                    <span class="check-ip">{{ srv.privateIp }}</span>
                  </label>
                </div>
                <div class="edit-actions">
                  <button class="btn-cancel" @click="cancelEdit">Cancel</button>
                  <button class="btn-save" :disabled="!editForm.name.trim() || editForm.serverIds.length === 0" @click="saveEdit">
                    Save
                  </button>
                </div>
              </div>
            </template>

          </div>
        </div>

        <div v-else-if="!addingNew" class="empty-groups">
          No groups yet. Create one to bundle servers together.
        </div>

        <!-- add new group form -->
        <div v-if="addingNew" class="add-form">
          <p class="section-title">New Group</p>
          <input
            v-model="newForm.name"
            type="text"
            class="input"
            placeholder="Group name"
            @keydown.enter="saveNew"
            @keydown.esc="cancelNew"
          />
          <p class="servers-label">Servers in this group</p>
          <div class="server-checklist">
            <label v-for="srv in servers" :key="srv.id" class="server-check">
              <input
                type="checkbox"
                :value="srv.id"
                v-model="newForm.serverIds"
              />
              <span class="check-name">{{ srv.name }}</span>
              <span class="check-ip">{{ srv.privateIp }}</span>
            </label>
          </div>
          <div class="edit-actions">
            <button class="btn-cancel" @click="cancelNew">Cancel</button>
            <button class="btn-save" :disabled="!newForm.name.trim() || newForm.serverIds.length === 0" @click="saveNew">
              Create Group
            </button>
          </div>
        </div>

      </div>

      <div class="modal-footer">
        <button v-if="!addingNew" class="btn-add" @click="startAdd">+ New Group</button>
        <button class="btn-done" @click="$emit('close')">Done</button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useGroups } from '../useGroups.js'

defineProps({
  servers: { type: Array, required: true },
})

const emit = defineEmits(['close'])

const { groups, addGroup, updateGroup, removeGroup } = useGroups()

// ── edit existing ──
const editingId = ref(null)
const editForm = reactive({ name: '', serverIds: [] })

function startEdit(group) {
  cancelNew()
  editingId.value = group.id
  editForm.name = group.name
  editForm.serverIds = [...group.serverIds]
}

function cancelEdit() {
  editingId.value = null
}

function saveEdit() {
  if (!editForm.name.trim() || editForm.serverIds.length === 0) return
  updateGroup(editingId.value, { name: editForm.name.trim(), serverIds: [...editForm.serverIds] })
  editingId.value = null
}

function deleteGroup(id) {
  if (window.confirm('Remove this group? The servers themselves won\'t be deleted.')) {
    removeGroup(id)
    if (editingId.value === id) editingId.value = null
  }
}

// ── add new ──
const addingNew = ref(false)
const newForm = reactive({ name: '', serverIds: [] })

function startAdd() {
  cancelEdit()
  addingNew.value = true
  newForm.name = ''
  newForm.serverIds = []
}

function cancelNew() {
  addingNew.value = false
}

function saveNew() {
  if (!newForm.name.trim() || newForm.serverIds.length === 0) return
  addGroup({ name: newForm.name.trim(), serverIds: [...newForm.serverIds] })
  addingNew.value = false
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
  max-width: 520px;
  max-height: 85vh;
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
  transition: color 0.15s, background 0.15s;
}

.close-btn:hover {
  color: var(--text);
  background: var(--surface2);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* groups list */
.groups-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-item {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
}

.group-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.group-name {
  font-family: 'Syne', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.group-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
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

/* forms */
.edit-form,
.add-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.add-form {
  border: 1px solid var(--border2);
  border-radius: 8px;
  padding: 14px;
  background: var(--surface2);
}

.section-title {
  font-family: 'Syne', sans-serif;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
  margin: 0;
}

.servers-label {
  font-family: 'Syne', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0;
}

.input {
  background: var(--surface);
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

.input:focus {
  border-color: var(--blue);
}

.server-checklist {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.server-check {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.12s;
}

.server-check:hover {
  background: var(--surface);
}

.server-check input[type="checkbox"] {
  accent-color: var(--blue);
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  cursor: pointer;
}

.check-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.check-ip {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--muted);
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.empty-groups {
  font-size: 13px;
  color: var(--muted);
  padding: 12px 0;
  text-align: center;
}

/* footer */
.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.btn-add {
  font-family: 'Syne', sans-serif;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  background: rgba(0, 150, 199, 0.1);
  border: 1px solid rgba(0, 150, 199, 0.35);
  border-radius: 6px;
  color: var(--blue);
  cursor: pointer;
  transition: background 0.15s;
}

.btn-add:hover {
  background: rgba(0, 150, 199, 0.18);
}

.btn-done {
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
  margin-left: auto;
}

.btn-done:hover {
  opacity: 0.85;
}

.btn-cancel {
  padding: 6px 14px;
  background: var(--surface);
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
}

.btn-save {
  padding: 6px 16px;
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

.modal-body::-webkit-scrollbar        { width: 5px; }
.modal-body::-webkit-scrollbar-track  { background: transparent; }
.modal-body::-webkit-scrollbar-thumb  { background: var(--border2); border-radius: 3px; }
</style>
