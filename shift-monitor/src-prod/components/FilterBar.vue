<template>
  <div class="filter-bar" role="group" aria-label="Filter servers">
    <button
      class="pill"
      :class="{ active: filter === 'all' }"
      @click="$emit('update:filter', 'all')"
    >
      All
    </button>

    <button
      v-for="group in groups"
      :key="group.id"
      class="pill"
      :class="{ active: filter === group.id }"
      @click="$emit('update:filter', group.id)"
    >
      {{ group.name }}
    </button>

    <button
      class="pill"
      :class="{ active: filter === 'down' }"
      @click="$emit('update:filter', 'down')"
    >
      Down Only
    </button>

    <button class="manage-btn" title="Create and edit server groups" @click="$emit('manage-groups')">
      ⊞ Groups
    </button>
  </div>
</template>

<script setup>
defineProps({
  filter: { type: String, required: true },
  groups: { type: Array, default: () => [] },
})

defineEmits(['update:filter', 'manage-groups'])
</script>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
  align-items: center;
}

.pill {
  padding: 5px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--muted);
  font-family: 'Syne', sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.pill:hover {
  color: var(--text);
  border-color: var(--border2);
}

.pill.active {
  color: var(--blue);
  background: rgba(0, 150, 199, 0.1);
  border-color: var(--blue);
}

.manage-btn {
  padding: 5px 12px;
  background: transparent;
  border: 1px dashed var(--border2);
  border-radius: 20px;
  color: var(--muted);
  font-family: 'Syne', sans-serif;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  white-space: nowrap;
}

.manage-btn:hover {
  color: var(--blue);
  border-color: var(--blue);
  background: rgba(0, 150, 199, 0.06);
}
</style>
