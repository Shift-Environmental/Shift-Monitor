import { ref } from 'vue'

const LS_KEY = 'shift-groups'

function loadGroups() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch { /* ignore */ }
  return []
}

function persist(list) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list))
  } catch { /* quota exceeded */ }
}

function uid() {
  return 'grp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

const groups = ref(loadGroups())

function addGroup(group) {
  const withId = { ...group, id: group.id || uid() }
  groups.value = [...groups.value, withId]
  persist(groups.value)
}

function updateGroup(id, updated) {
  groups.value = groups.value.map((g) => (g.id === id ? { ...g, ...updated, id } : g))
  persist(groups.value)
}

function removeGroup(id) {
  groups.value = groups.value.filter((g) => g.id !== id)
  persist(groups.value)
}

export function useGroups() {
  return { groups, addGroup, updateGroup, removeGroup }
}
