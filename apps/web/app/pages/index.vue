<script setup lang="ts">
const config = useRuntimeConfig()

interface HealthResponse {
  status: string
  services: Record<string, { status: string }>
}

const { data, error, refresh, status } = await useFetch<HealthResponse>(
  `${config.public.apiBase}/health`,
  { server: false, lazy: true }
)
</script>

<template>
  <div>
    <h1>Dashboard</h1>
    <p style="color: var(--muted)">Status der safAIr-Services (via Gateway).</p>

    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center">
        <h2 style="margin: 0">Services</h2>
        <button :disabled="status === 'pending'" @click="refresh()">Aktualisieren</button>
      </div>

      <p v-if="status === 'pending'" style="color: var(--muted)">Lade Status …</p>
      <p v-else-if="error" style="color: var(--err)">
        Gateway nicht erreichbar ({{ config.public.apiBase }}). Läuft <code>docker compose up</code>?
      </p>
      <ul v-else-if="data" style="list-style: none; padding: 0; margin-top: 1rem">
        <li
          v-for="(svc, name) in data.services"
          :key="name"
          style="display: flex; justify-content: space-between; padding: 0.6rem 0; border-top: 1px solid var(--border)"
        >
          <span>{{ name }}</span>
          <span :style="{ color: svc.status === 'ok' ? 'var(--ok)' : 'var(--err)' }">
            {{ svc.status === 'ok' ? '● online' : '● offline' }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
