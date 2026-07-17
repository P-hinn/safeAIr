<script setup lang="ts">
const config = useRuntimeConfig()

const text = ref('Hallo, ich bin Max Mustermann, meine E-Mail ist max@example.com und meine Telefonnummer ist +49 151 12345678.')
const language = ref<'de' | 'en'>('de')
const result = ref<unknown>(null)
const loading = ref(false)
const errorMsg = ref('')

async function anonymize() {
  loading.value = true
  errorMsg.value = ''
  result.value = null
  try {
    result.value = await $fetch(`${config.public.apiBase}/api/pii/v1/anonymize`, {
      method: 'POST',
      body: { text: text.value, language: language.value }
    })
  } catch (e: any) {
    errorMsg.value = e?.message ?? 'Anfrage fehlgeschlagen'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h1>PII-Anonymisierung</h1>
    <p style="color: var(--muted)">Text eingeben – der PII-Service (Presidio) erkennt und maskiert personenbezogene Daten.</p>

    <div class="card">
      <textarea v-model="text" />
      <div style="display: flex; gap: 1rem; align-items: center; margin-top: 1rem">
        <select v-model="language" style="background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem">
          <option value="de">Deutsch</option>
          <option value="en">Englisch</option>
        </select>
        <button :disabled="loading || !text" @click="anonymize">
          {{ loading ? 'Anonymisiere …' : 'Anonymisieren' }}
        </button>
      </div>

      <p v-if="errorMsg" style="color: var(--err)">{{ errorMsg }}</p>
      <pre v-if="result" class="result">{{ JSON.stringify(result, null, 2) }}</pre>
    </div>
  </div>
</template>
