<script setup lang="ts">
const config = useRuntimeConfig()
const api = config.public.apiBase

interface Policy { id: string; name: string; builtin: boolean; config: Record<string, any> }

const { data, refresh } = await useFetch<{ policies: Policy[] }>(`${api}/api/orchestrator/v1/policies`, { server: false, lazy: true, credentials: 'include' })
const { data: piiEngines } = await useFetch<{ engines: { name: string; status: string }[] }>(`${api}/api/pii/v1/engines`, { server: false, lazy: true, credentials: 'include' })
const { data: grEngines } = await useFetch<{ engines: { name: string; status: string }[] }>(`${api}/api/guardrails/v1/engines`, { server: false, lazy: true, credentials: 'include' })

const editing = ref<Policy | null>(null)
const isNew = ref(false)
const saving = ref(false)
const errorMsg = ref('')

function emptyConfig() {
  return {
    fail_closed: false,
    language: 'de',
    pii_prompt: { enabled: true, engine: 'presidio', mode: 'anonymize' },
    guardrails_prompt: { enabled: true, engine: 'heuristic', action: 'block' },
    moderation_prompt: { enabled: false, action: 'warn' },
    llm: { provider: 'ollama', model: 'llama3.2' },
    guardrails_output: { enabled: true, engine: 'heuristic', action: 'warn' },
    moderation_output: { enabled: false, action: 'warn' },
    pii_output: { enabled: false, engine: 'presidio', mode: 'anonymize' }
  }
}

function startNew() {
  isNew.value = true
  editing.value = { id: '', name: 'Neue Policy', builtin: false, config: emptyConfig() }
}

function startEdit(p: Policy) {
  isNew.value = false
  editing.value = JSON.parse(JSON.stringify(p))
}

async function save() {
  if (!editing.value) return
  saving.value = true
  errorMsg.value = ''
  try {
    if (isNew.value) {
      await $fetch(`${api}/api/orchestrator/v1/policies`, { credentials: 'include', method: 'POST', body: { name: editing.value.name, config: editing.value.config } })
    } else {
      await $fetch(`${api}/api/orchestrator/v1/policies/${editing.value.id}`, { credentials: 'include', method: 'PUT', body: { name: editing.value.name, config: editing.value.config } })
    }
    editing.value = null
    await refresh()
  } catch (e: any) {
    errorMsg.value = e?.data?.detail?.error?.message ?? e?.message ?? 'Speichern fehlgeschlagen'
  } finally {
    saving.value = false
  }
}

async function remove(p: Policy) {
  if (!confirm(`Policy "${p.name}" löschen?`)) return
  try {
    await $fetch(`${api}/api/orchestrator/v1/policies/${p.id}`, { credentials: 'include', method: 'DELETE' })
    await refresh()
  } catch (e: any) {
    errorMsg.value = e?.data?.detail?.error?.message ?? 'Löschen fehlgeschlagen'
  }
}

const stepDefs = [
  { key: 'pii_prompt', label: 'PII-Check (Eingabe)', type: 'pii' },
  { key: 'guardrails_prompt', label: 'Guardrails (Eingabe)', type: 'guardrails' },
  { key: 'moderation_prompt', label: 'Moderation (Eingabe)', type: 'moderation' },
  { key: 'guardrails_output', label: 'Guardrails (Antwort)', type: 'guardrails' },
  { key: 'moderation_output', label: 'Moderation (Antwort)', type: 'moderation' },
  { key: 'pii_output', label: 'PII-Check (Antwort)', type: 'pii' }
]

const selectStyle = 'background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 0; padding: 0.4rem'
</script>

<template>
  <div>
    <h1>Safety-Policies</h1>
    <p style="color: var(--muted)">Policies definieren, welche Checks eine Nachricht durchläuft und was bei Treffern passiert.</p>

    <div class="card" v-if="!editing">
      <div style="display: flex; justify-content: space-between; align-items: center">
        <h2 style="margin: 0">Vorhandene Policies</h2>
        <button @click="startNew">Neue Policy</button>
      </div>
      <ul style="list-style: none; padding: 0">
        <li
          v-for="p in data?.policies ?? []"
          :key="p.id"
          style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.6rem 0; border-top: 1px solid var(--border)"
        >
          <span>
            {{ p.name }}
            <span v-if="p.builtin" style="color: var(--muted); font-size: 0.8rem">(eingebaut)</span>
            <span style="color: var(--muted); font-size: 0.8rem; display: block">
              LLM: {{ p.config?.llm?.provider }}/{{ p.config?.llm?.model }} ·
              {{ p.config?.fail_closed ? 'fail-closed' : 'fail-open' }}
            </span>
          </span>
          <span style="display: flex; gap: 0.5rem">
            <button style="padding: 0.35rem 0.8rem" @click="startEdit(p)">Bearbeiten</button>
            <button v-if="!p.builtin" style="padding: 0.35rem 0.8rem; background: var(--err)" @click="remove(p)">Löschen</button>
          </span>
        </li>
      </ul>
      <p v-if="errorMsg" style="color: var(--err)">{{ errorMsg }}</p>
    </div>

    <div class="card" v-else>
      <h2 style="margin-top: 0">{{ isNew ? 'Neue Policy' : `Policy: ${editing.name}` }}</h2>

      <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1rem">
        <label style="color: var(--muted); font-size: 0.85rem">Name
          <input v-model="editing.name" :style="selectStyle + '; display: block; margin-top: 0.25rem'" />
        </label>
        <label style="color: var(--muted); font-size: 0.85rem">Sprache (PII)
          <select v-model="editing.config.language" :style="selectStyle + '; display: block; margin-top: 0.25rem'">
            <option value="de">Deutsch</option>
            <option value="en">Englisch</option>
          </select>
        </label>
        <label style="color: var(--muted); font-size: 0.85rem; display: flex; align-items: end; gap: 0.4rem; padding-bottom: 0.3rem">
          <input type="checkbox" v-model="editing.config.fail_closed" />
          fail-closed (Service-Fehler blockiert Anfrage)
        </label>
      </div>

      <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1rem">
        <label style="color: var(--muted); font-size: 0.85rem">LLM-Provider (Default)
          <select v-model="editing.config.llm.provider" :style="selectStyle + '; display: block; margin-top: 0.25rem'">
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>
        <label style="color: var(--muted); font-size: 0.85rem">Modell (Default)
          <input v-model="editing.config.llm.model" :style="selectStyle + '; display: block; margin-top: 0.25rem'" />
        </label>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem">
        <thead>
          <tr style="color: var(--muted); text-align: left">
            <th style="padding: 0.4rem 0">Schritt</th>
            <th>Aktiv</th>
            <th>Engine</th>
            <th>Bei Treffer</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in stepDefs" :key="s.key" style="border-top: 1px solid var(--border)">
            <td style="padding: 0.5rem 0">{{ s.label }}</td>
            <td><input type="checkbox" v-model="editing.config[s.key].enabled" /></td>
            <td>
              <select v-if="s.type === 'pii'" v-model="editing.config[s.key].engine" :style="selectStyle">
                <option v-for="e in piiEngines?.engines ?? []" :key="e.name" :value="e.name" :disabled="e.status !== 'ready'">{{ e.name }}</option>
              </select>
              <select v-else-if="s.type === 'guardrails'" v-model="editing.config[s.key].engine" :style="selectStyle">
                <option v-for="e in grEngines?.engines ?? []" :key="e.name" :value="e.name" :disabled="e.status !== 'ready'">{{ e.name }}</option>
              </select>
              <span v-else style="color: var(--muted)">llama-guard</span>
            </td>
            <td>
              <select v-if="s.type === 'pii'" v-model="editing.config[s.key].mode" :style="selectStyle">
                <option value="anonymize">maskieren</option>
                <option value="block">blockieren</option>
              </select>
              <select v-else v-model="editing.config[s.key].action" :style="selectStyle">
                <option value="warn">warnen</option>
                <option value="block">blockieren</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-if="errorMsg" style="color: var(--err)">{{ errorMsg }}</p>
      <div style="display: flex; gap: 0.75rem; margin-top: 1.25rem">
        <button :disabled="saving" @click="save">{{ saving ? 'Speichere …' : 'Speichern' }}</button>
        <button class="button-secondary" @click="editing = null">Abbrechen</button>
      </div>
    </div>
  </div>
</template>
