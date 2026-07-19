<script setup lang="ts">
const config = useRuntimeConfig()

interface EngineInfo {
  name: string
  title: string
  status: string
  detail: string
}

const { data: engineData } = await useFetch<{ default: string; engines: EngineInfo[] }>(
  `${config.public.apiBase}/api/pii/v1/engines`,
  { server: false, lazy: true, credentials: 'include' }
)

const text = ref('Hallo, ich bin Max Mustermann, meine E-Mail ist max@example.com und meine Telefonnummer ist +49 151 12345678.')
const language = ref<'de' | 'en'>('de')
const engine = ref('presidio')
const result = ref<unknown>(null)
const loading = ref(false)
const errorMsg = ref('')

async function anonymize() {
  loading.value = true
  errorMsg.value = ''
  result.value = null
  try {
    result.value = await $fetch(`${config.public.apiBase}/api/pii/v1/anonymize`, {
      credentials: 'include',
      method: 'POST',
      body: { text: text.value, language: language.value, engine: engine.value }
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
    <h1>PII-Anonymisierung</h1>
    <p style="color: var(--muted)">Text eingeben – die gewählte Engine erkennt und maskiert personenbezogene Daten.</p>

    <div class="card">
      <textarea v-model="text" />
      <div style="display: flex; gap: 1rem; align-items: center; margin-top: 1rem; flex-wrap: wrap">
        <select v-model="engine" style="background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 0; padding: 0.5rem">
          <option
            v-for="e in engineData?.engines ?? [{ name: 'presidio', title: 'Microsoft Presidio', status: 'ready', detail: '' }]"
            :key="e.name"
            :value="e.name"
            :disabled="e.status !== 'ready'"
          >
            {{ e.title }}{{ e.status !== 'ready' ? ' (nicht aktiv)' : '' }}
          </option>
        </select>
        <select v-model="language" style="background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 0; padding: 0.5rem">
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
