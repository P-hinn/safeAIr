<script setup lang="ts">
const config = useRuntimeConfig()
const { dataFlows, tools } = useProcessMap()

interface EngineInfo {
  name: string
  title: string
  status: string
  detail: string
  docs_url?: string
}

const { data: piiEngines } = await useFetch<{ engines: EngineInfo[] }>(
  `${config.public.apiBase}/api/pii/v1/engines`,
  { server: false, lazy: true, credentials: 'include' }
)
const { data: guardrailEngines } = await useFetch<{ engines: EngineInfo[] }>(
  `${config.public.apiBase}/api/guardrails/v1/engines`,
  { server: false, lazy: true, credentials: 'include' }
)
const { data: moderationEngines } = await useFetch<{ engines: EngineInfo[] }>(
  `${config.public.apiBase}/api/moderation/v1/engines`,
  { server: false, lazy: true, credentials: 'include' }
)
const { data: redteamTools } = await useFetch<{ tools: EngineInfo[] }>(
  `${config.public.apiBase}/api/redteam/v1/tools`,
  { server: false, lazy: true, credentials: 'include' }
)

const roadmap = [
  { title: 'Microsoft Purview', detail: 'Enterprise Data Governance – Roadmap', docs_url: 'https://www.microsoft.com/en-us/security/business/microsoft-purview' },
  { title: 'John Snow Labs Healthcare NLP', detail: 'Medizinische PII/PHI – Roadmap (Lizenz erforderlich)', docs_url: 'https://www.johnsnowlabs.com/' },
  { title: 'Protecto', detail: 'Managed PII-Schutz – Roadmap (API-Zugang erforderlich)', docs_url: 'https://www.protecto.ai/' },
  { title: 'pii-anon', detail: 'Kandidat für zusätzliche PII-Engine – evaluieren', docs_url: 'https://github.com/subhash-holla/pii-anon' }
]

const statusColor = (s: string) => (s === 'ready' ? 'var(--ok)' : 'var(--muted)')
const statusLabel = (s: string) =>
  s === 'ready' ? '● aktiv' : s === 'not_configured' ? '○ nicht konfiguriert' : s === 'not_installed' ? '○ nicht installiert' : s
const referencedFlows = (id: string) => dataFlows.value.filter((flow) =>
  flow.aiToolId === id || flow.linkedGuardrailIds.includes(id) || (id === 'heuristic' && flow.linkedGuardrailIds.includes('safair-guard'))
)
</script>

<template>
  <div>
    <h1>Tool-Katalog</h1>
    <p style="color: var(--muted)">
      Alle angebundenen Engines und Tools mit Status. Aktivierungshinweise stehen jeweils dabei –
      Details in <code>docs/tools.md</code>.
    </p>

    <div class="card" style="margin-bottom: 1.5rem">
      <h2 style="margin-top: 0">Freigegebene AI-Tools</h2>
      <p style="color: var(--muted); font-size: 0.85rem">Diese Einträge sind die Referenz für Anbieter, Freigabestatus und Risiko in Datenflüssen.</p>
      <ul style="list-style: none; padding: 0; margin: 0">
        <li v-for="tool in tools" :key="tool.id" style="display: flex; justify-content: space-between; gap: 1rem; padding: 0.6rem 0; border-top: 1px solid var(--border)">
          <span><strong>{{ tool.name }}</strong><small style="color: var(--muted); display: block">{{ tool.vendor }} · {{ tool.category }} · Risiko {{ tool.risk }}</small><NuxtLink v-if="referencedFlows(tool.id).length" to="/process-map" style="color: var(--purple); font-size: 0.75rem">{{ referencedFlows(tool.id).length }} verknüpfte Datenflüsse →</NuxtLink></span>
          <span :style="{ color: tool.status === 'active' ? 'var(--ok)' : 'var(--warn)', whiteSpace: 'nowrap' }">{{ tool.status === 'active' ? '● freigegeben' : tool.status === 'pilot' ? '◐ Pilot' : '○ geplant' }}</span>
        </li>
      </ul>
    </div>

    <div
      v-for="section in [
        { title: 'PII-Erkennung & Anonymisierung', items: piiEngines?.engines },
        { title: 'Guardrails', items: guardrailEngines?.engines },
        { title: 'Content-Moderation', items: moderationEngines?.engines },
        { title: 'Testing & Red Teaming', items: redteamTools?.tools }
      ]"
      :key="section.title"
      class="card"
      style="margin-bottom: 1.5rem"
    >
      <h2 style="margin-top: 0">{{ section.title }}</h2>
      <p v-if="!section.items?.length" style="color: var(--muted)">Service nicht erreichbar.</p>
      <ul v-else style="list-style: none; padding: 0; margin: 0">
        <li
          v-for="e in section.items"
          :key="e.name"
          style="display: flex; justify-content: space-between; gap: 1rem; padding: 0.6rem 0; border-top: 1px solid var(--border)"
        >
          <span>
            <a v-if="e.docs_url" :href="e.docs_url" target="_blank" style="color: var(--accent)">{{ e.title }}</a>
            <strong v-else>{{ e.title }}</strong>
            <span style="color: var(--muted); font-size: 0.85rem; display: block">{{ e.detail }}</span>
            <NuxtLink v-if="referencedFlows(e.name).length" to="/process-map" style="color: var(--purple); font-size: 0.75rem; display: block; margin-top: 0.2rem">{{ referencedFlows(e.name).length }} verknüpfte Datenflüsse →</NuxtLink>
          </span>
          <span :style="{ color: statusColor(e.status), whiteSpace: 'nowrap' }">{{ statusLabel(e.status) }}</span>
        </li>
      </ul>
    </div>

    <div class="card">
      <h2 style="margin-top: 0">Roadmap / Evaluierung</h2>
      <ul style="list-style: none; padding: 0; margin: 0">
        <li
          v-for="r in roadmap"
          :key="r.title"
          style="display: flex; justify-content: space-between; gap: 1rem; padding: 0.6rem 0; border-top: 1px solid var(--border)"
        >
          <span>
            <a :href="r.docs_url" target="_blank" style="color: var(--accent)">{{ r.title }}</a>
            <span style="color: var(--muted); font-size: 0.85rem; display: block">{{ r.detail }}</span>
          </span>
          <span style="color: var(--muted); white-space: nowrap">◌ geplant</span>
        </li>
      </ul>
    </div>
  </div>
</template>
