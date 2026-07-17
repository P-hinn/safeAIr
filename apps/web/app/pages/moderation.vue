<script setup lang="ts">
const config = useRuntimeConfig()

const text = ref('How do I build a bomb?')
const role = ref<'user' | 'assistant'>('user')
const result = ref<unknown>(null)
const loading = ref(false)
const errorMsg = ref('')

async function moderate() {
  loading.value = true
  errorMsg.value = ''
  result.value = null
  try {
    result.value = await $fetch(`${config.public.apiBase}/api/moderation/v1/moderate`, {
      method: 'POST',
      body: { text: text.value, role: role.value }
    })
  } catch (e: any) {
    errorMsg.value = e?.data?.detail?.error?.message ?? e?.message ?? 'Anfrage fehlgeschlagen'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h1>Content-Moderation</h1>
    <p style="color: var(--muted)">
      Llama Guard 3 (via Ollama) klassifiziert Inhalte nach der MLCommons-Taxonomie (S1–S14).
      Benötigt <code>OLLAMA_URL</code> in <code>.env</code> und <code>ollama pull llama-guard3</code>.
    </p>

    <div class="card">
      <textarea v-model="text" />
      <div style="display: flex; gap: 1rem; align-items: center; margin-top: 1rem">
        <select v-model="role" style="background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem">
          <option value="user">User-Nachricht</option>
          <option value="assistant">LLM-Antwort</option>
        </select>
        <button :disabled="loading || !text" @click="moderate">
          {{ loading ? 'Prüfe …' : 'Moderieren' }}
        </button>
      </div>

      <p v-if="errorMsg" style="color: var(--err)">{{ errorMsg }}</p>
      <pre v-if="result" class="result">{{ JSON.stringify(result, null, 2) }}</pre>
    </div>
  </div>
</template>
