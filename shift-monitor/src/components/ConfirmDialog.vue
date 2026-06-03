<template>
  <div class="confirm-overlay" @mousedown.self="$emit('cancel')">
    <div class="confirm-box" role="dialog" aria-modal="true">
      <p class="confirm-msg">{{ message }}</p>
      <div class="confirm-actions">
        <button class="btn-cancel" @click="$emit('cancel')">Cancel</button>
        <button class="btn-confirm" @click="$emit('confirm')">{{ confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  message:      { type: String, required: true },
  confirmLabel: { type: String, default: 'Remove' },
})
defineEmits(['confirm', 'cancel'])
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirm-box {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 10px;
  padding: 24px 28px;
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.confirm-msg {
  font-family: 'Syne', sans-serif;
  font-size: 14px;
  color: var(--text);
  line-height: 1.5;
  text-align: center;
}

.confirm-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
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
}

.btn-confirm {
  padding: 7px 18px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 6px;
  color: var(--down);
  font-family: 'Syne', sans-serif;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.btn-confirm:hover {
  background: rgba(239, 68, 68, 0.22);
  border-color: var(--down);
}
</style>
