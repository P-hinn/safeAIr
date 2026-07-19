<script setup lang="ts">
const config = useRuntimeConfig()

interface ToolInfo {
  name: string
  title: string
  status: string
  detail: string
  docs_url: string
}

interface ScanJob {
  id: string
  tool: string
  args: string[]
  status: string
  started_at: string
  log_tail?: string
}

const { data: toolData } = await useFetch<{ tools: ToolInfo[] }>(
  `${config.public.apiBase}/api/redteam/v1/tools`,
  { server: false, lazy: true, credentials: 'include' }
)

const { data: scanData, refresh: refreshScans } = await useFetch<{ scans: ScanJob[] }>(
  `${config.public.apiBase}/api/redteam/v1/scans`,
  { server: false, lazy: true, credentials: 'include' }
)

const selectedJob = ref<ScanJob | null>(null)

async function showJob(id: string) {
  selectedJob.value = await $fetch<ScanJob>(`${config.public.apiBase}/api/redteam/v1/scans/${id}`, {
    credentials: 'include'
  })
}
</script>

<template>
  <div>
    <h1>Red Teaming</h1>
    <p style="color: var(--muted)">
      Scan-Läufe mit Promptfoo oder Garak. Jobs werden per API gestartet
      (<code>POST /api/redteam/v1/scans</code>), z. B. aus CI oder per curl – Beispiele in der README des Service.
    </p>

    <div class="card">
      <h2 style="margin-top: 0">Tools</h2>
      <ul style="list-style: none; padding: 0">
        <li
          v-for="t in toolData?.tools ?? []"
          :key="t.name"
          style="display: flex; justify-content: space-between; gap: 1rem; padding: 0.6rem 0; border-top: 1px solid var(--border)"
        >
          <span>
            <a :href="t.docs_url" target="_blank" style="color: var(--accent)">{{ t.title }}</a>
            <span style="color: var(--muted); font-size: 0.85rem; display: block">{{ t.detail }}</span>
          </span>
          <span :style="{ color: t.status === 'ready' ? 'var(--ok)' : 'var(--muted)' }">{{ t.status }}</span>
        </li>
      </ul>
    </div>

    <div class="card" style="margin-top: 1.5rem">
      <div style="display: flex; justify-content: space-between; align-items: center">
        <h2 style="margin: 0">Scan-Jobs</h2>
        <button @click="refreshScans()">Aktualisieren</button>
      </div>
      <p v-if="!scanData?.scans?.length" style="color: var(--muted)">Noch keine Jobs.</p>
      <ul v-else style="list-style: none; padding: 0">
        <li
          v-for="s in scanData.scans"
          :key="s.id"
          style="display: flex; justify-content: space-between; padding: 0.6rem 0; border-top: 1px solid var(--border); cursor: pointer"
          @click="showJob(s.id)"
        >
          <span>{{ s.tool }} · {{ s.args.join(' ') || '(ohne Argumente)' }}</span>
          <span :style="{ color: s.status === 'completed' ? 'var(--ok)' : s.status === 'failed' ? 'var(--err)' : 'var(--muted)' }">
            {{ s.status }}
          </span>
        </li>
      </ul>
      <pre v-if="selectedJob?.log_tail" class="result">{{ selectedJob.log_tail }}</pre>
    </div>
  </div>
</template>
