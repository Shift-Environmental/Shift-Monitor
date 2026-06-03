import { ref } from 'vue'

const LS_KEY = 'shift-theme'

const theme = ref(localStorage.getItem(LS_KEY) || 'dark')

// Apply immediately on module load to avoid flash of wrong theme.
document.documentElement.setAttribute('data-theme', theme.value)

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem(LS_KEY, theme.value)
  document.documentElement.setAttribute('data-theme', theme.value)
}

export function useTheme() {
  return { theme, toggleTheme }
}
