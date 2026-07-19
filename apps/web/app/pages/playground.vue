<script setup lang="ts">
const config = useRuntimeConfig()
const api = config.public.apiBase

interface TraceEntry {
  step: string
  status: string
  detail: string
  duration_ms: number
}

interface ChatEntry {
  role: 'user' | 'assistant'
  content: string
  blocked?: boolean
  trace?: TraceEntry[]
  showTrace?: boolean
}

interface Policy { id: string; name: string; config: Record<string, any> }
interface Provider { name: string; title: string; status: string; models: string[] }

const { data: policyData } = await useFetch<{ policies: Policy[] }>(`${api}/api/orchestrator/v1/policies`, { server: false, lazy: true, credentials: 'include' })
const { data: providerData } = await useFetch<{ providers: Provider[] }>(`${api}/api/orchestrator/v1/providers`, { server: false, lazy: true, credentials: 'include' })

const policyId = ref('standard')
const provider = ref('')
const model = ref('')
const input = ref('Hallo! Ich bin Max Mustermann (max@example.com). Fasse mir bitte kurz zusammen, was DSGVO-konforme AI-Nutzung bedeutet.')
const messages = ref<ChatEntry[]>([])
const loading = ref(false)
const errorMsg = ref('')

const activeProvider = computed(() => providerData.value?.providers.find((p) => p.name === provider.value))

watch(providerData, (d) => {
  if (d && !provider.value) {
    const ready = d.providers.find((p) => p.status === 'ready')
    if (ready) {
      provider.value = ready.name
      model.value = ready.models[0] ?? ''
    }
  }
}, { immediate: true })

watch(provider, () => {
  model.value = activeProvider.value?.models[0] ?? ''
})

const stepColor = (s: string) =>
  s === 'ok' ? 'var(--ok)' : s === 'blocked' ? 'var(--err)' : s === 'modified' || s === 'warned' ? '#e8a13c' : 'var(--muted)'

async function send() {
  if (!input.value || loading.value) return
  const text = input.value
  input.value = ''
  errorMsg.value = ''
  messages.value.push({ role: 'user', content: text })
  loading.value = true
  try {
    const history = messages.value
      .slice(0, -1)
      .filter((m) => !m.blocked)
      .map((m) => ({ role: m.role, content: m.content }))
    const res = await $fetch<{ reply: string; blocked: boolean; trace: TraceEntry[] }>(
      `${api}/api/orchestrator/v1/chat`,
      {
        credentials: 'include',
        method: 'POST',
        body: {
          message: text,
          history,
          policy_id: policyId.value,
          provider: provider.value || undefined,
          model: model.value || undefined
        },
        timeout: 180000
      }
    )
    messages.value.push({ role: 'assistant', content: res.reply, blocked: res.blocked, trace: res.trace, showTrace: res.blocked })
  } catch (e: any) {
    errorMsg.value = e?.data?.detail?.error?.message ?? e?.message ?? 'Anfrage fehlgeschlagen'
    messages.value.pop()
    input.value = text
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h1>Playground</h1>
    <p style="color: var(--muted)">
      Jede Nachricht läuft durch die gewählte Safety-Policy – der Trace zeigt, was pro Schritt passiert ist.
    </p>

    <div class="card" style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem">
      <label style="color: var(--muted); font-size: 0.85rem">Policy
        <select v-model="policyId" style="display: block; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 0; padding: 0.45rem; margin-top: 0.25rem">
          <option v-for="p in policyData?.policies ?? []" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
      <label style="color: var(--muted); font-size: 0.85rem">Provider
        <select v-model="provider" style="display: block; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 0; padding: 0.45rem; margin-top: 0.25rem">
          <option v-for="p in providerData?.providers ?? []" :key="p.name" :value="p.name" :disabled="p.status !== 'ready'">
            {{ p.title }}{{ p.status !== 'ready' ? ' (nicht konfiguriert)' : '' }}
          </option>
        </select>
      </label>
      <label style="color: var(--muted); font-size: 0.85rem">Modell
        <select v-if="activeProvider?.models?.length" v-model="model" style="display: block; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 0; padding: 0.45rem; margin-top: 0.25rem">
          <option v-for="m in activeProvider.models" :key="m" :value="m">{{ m }}</option>
        </select>
        <input v-else v-model="model" placeholder="z. B. llama3.2" style="display: block; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 0; padding: 0.45rem; margin-top: 0.25rem" />
      </label>
      <NuxtLink to="/policies" style="color: var(--accent); font-size: 0.85rem; margin-left: auto">Policies bearbeiten →</NuxtLink>
    </div>

    <div class="card" style="min-height: 320px; display: flex; flex-direction: column; gap: 0.75rem">
      <p v-if="!messages.length" style="color: var(--muted)">Noch keine Nachrichten.</p>
      <div v-for="(m, i) in messages" :key="i">
        <div
          :style="{
            background: m.role === 'user' ? 'var(--accent)' : m.blocked ? 'rgba(229,83,75,0.15)' : 'var(--bg)',
            border: m.role === 'user' ? 'none' : '1px solid var(--border)',
            color: m.role === 'user' ? '#fff' : 'var(--text)',
            borderRadius: '10px',
            padding: '0.7rem 1rem',
            maxWidth: '85%',
            marginLeft: m.role === 'user' ? 'auto' : '0',
            whiteSpace: 'pre-wrap'
          }"
        >{{ m.content }}</div>
        <div v-if="m.trace" style="margin-top: 0.35rem">
          <a style="color: var(--muted); font-size: 0.8rem; cursor: pointer" @click="m.showTrace = !m.showTrace">
            {{ m.showTrace ? '▾' : '▸' }} Pipeline-Trace ({{ m.trace.length }} Schritte)
          </a>
          <ul v-if="m.showTrace" style="list-style: none; padding: 0.5rem 0 0 0; margin: 0; font-size: 0.85rem">
            <li v-for="t in m.trace" :key="t.step" style="display: flex; gap: 0.75rem; padding: 0.25rem 0; border-top: 1px solid var(--border)">
              <span :style="{ color: stepColor(t.status), minWidth: '90px' }">{{ t.status }}</span>
              <span style="min-width: 150px; color: var(--text)">{{ t.step }}</span>
              <span style="color: var(--muted); flex: 1">{{ t.detail }}</span>
              <span style="color: var(--muted)">{{ t.duration_ms }} ms</span>
            </li>
          </ul>
        </div>
      </div>
      <p v-if="loading" style="color: var(--muted)">Pipeline läuft …</p>
      <p v-if="errorMsg" style="color: var(--err)">{{ errorMsg }}</p>

      <form style="display: flex; gap: 0.75rem; margin-top: auto" @submit.prevent="send">
        <input
          v-model="input"
          placeholder="Nachricht eingeben …"
          style="flex: 1; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 0; padding: 0.7rem"
        />
        <button :disabled="loading || !input" type="submit">Senden</button>
      </form>
    </div>
  </div>
</template>
