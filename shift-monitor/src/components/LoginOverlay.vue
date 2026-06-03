<template>
  <div class="login-overlay">
    <div class="login-card">
      <img
        src="https://images.squarespace-cdn.com/content/v1/6a02b422e7098049073dc81e/09b49f60-b51a-43a3-98f3-d792932fc98a/Horizontal+Shift+Logo+Reversed.png?format=750w"
        alt="Shift Coastal Technologies"
        class="login-logo"
      />
      <span class="login-product">monitor</span>
      <p class="subtitle">Enter your password to continue</p>

      <form @submit.prevent="submit">
        <input
          ref="inputRef"
          v-model="password"
          type="password"
          class="password-input"
          placeholder="Password"
          autocomplete="current-password"
          :disabled="loading"
        />
        <p v-if="error" class="error-msg">{{ error }}</p>
        <button type="submit" class="login-btn" :disabled="loading || !password">
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['authenticated'])

const password = ref('')
const loading  = ref(false)
const error    = ref('')
const inputRef = ref(null)

onMounted(() => inputRef.value?.focus())

async function submit() {
  if (!password.value || loading.value) return
  loading.value = true
  error.value   = ''
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value }),
    })
    if (res.ok) {
      emit('authenticated')
    } else {
      error.value    = 'Incorrect password'
      password.value = ''
      inputRef.value?.focus()
    }
  } catch {
    error.value = 'Connection error — please try again'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.login-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 48px 40px;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.login-logo {
  height: 36px;
  width: auto;
  display: block;
  margin-bottom: 2px;
}

.login-product {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}

.subtitle {
  font-size: 13px;
  color: var(--muted);
  margin: 0 0 16px;
}

form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.password-input {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.password-input:focus {
  border-color: var(--blue);
}

.password-input:disabled {
  opacity: 0.5;
}

.error-msg {
  font-size: 12px;
  color: var(--down);
  margin: 0;
  text-align: center;
}

.login-btn {
  width: 100%;
  padding: 10px;
  background: var(--blue);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-family: 'Syne', sans-serif;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.login-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.login-btn:not(:disabled):hover {
  opacity: 0.85;
}
</style>
