<script setup lang="ts">
type MonitorStatus = 'up' | 'degraded' | 'down'
type CapabilityStatus = 'available' | 'unconfigured' | 'unavailable' | 'issue'

interface CheckResult {
  id: string
  name: string
  service: string
  path: string
  kind: 'health' | 'inventory' | 'api'
  critical: boolean
  status: MonitorStatus
  statusCode: number | null
  latencyMs: number
  checkedAt: string
  error?: string
}

interface HistorySample { checkedAt: string; status: MonitorStatus; latencyMs: number }
interface Capability {
  id: string
  name: string
  service: string
  category: string
  status: CapabilityStatus
  sourceStatus: string
  detail: string
  parentId?: string
}
interface ServiceMonitor {
  id: string
  name: string
  status: MonitorStatus
  latencyMs: number
  endpointsUp: number
  endpointsTotal: number
  capabilityIssues: number
  uptimePercent: number
}
interface MonitoringSnapshot {
  status: MonitorStatus
  checkedAt: string
  durationMs: number
  checks: CheckResult[]
  services: ServiceMonitor[]
  capabilities: Capability[]
  history: Record<string, HistorySample[]>
  summary: {
    servicesUp: number
    servicesTotal: number
    endpointsUp: number
    endpointsTotal: number
    capabilitiesAvailable: number
    capabilitiesTotal: number
    averageLatencyMs: number
    uptimePercent: number
    activeIssues: number
  }
}

const config = useRuntimeConfig()
const api = config.public.apiBase
const { data, error, status, refresh } = await useFetch<MonitoringSnapshot>(`${api}/monitoring`, {
  server: false,
  lazy: true
})

const forceRefreshing = ref(false)
const activeService = ref('all')
let pollTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  pollTimer = setInterval(() => { void refresh() }, 30_000)
})
onBeforeUnmount(() => { if (pollTimer) clearInterval(pollTimer) })

async function forceRefresh() {
  if (forceRefreshing.value) return
  forceRefreshing.value = true
  try {
    data.value = await $fetch<MonitoringSnapshot>(`${api}/monitoring/refresh`, { method: 'POST' })
  } finally {
    forceRefreshing.value = false
  }
}

const sortedChecks = computed(() => [...(data.value?.checks ?? [])]
  .filter((check) => activeService.value === 'all' || check.service === activeService.value)
  .sort((a, b) => {
    const priority = { down: 0, degraded: 1, up: 2 }
    return priority[a.status] - priority[b.status] || a.service.localeCompare(b.service)
  }))

const providers = computed(() => data.value?.capabilities.filter((item) => item.category === 'AI Provider') ?? [])
const providerModels = (providerId: string) => data.value?.capabilities.filter((item) => item.parentId === providerId) ?? []
const safetyCapabilities = computed(() => data.value?.capabilities.filter((item) => !['AI Provider', 'AI Model'].includes(item.category)) ?? [])
const configurationGaps = computed(() => data.value?.capabilities.filter((item) => item.status !== 'available') ?? [])
const endpointIssues = computed(() => data.value?.checks.filter((check) => check.status !== 'up') ?? [])

const issueCount = computed(() => endpointIssues.value.length + configurationGaps.value.length)
const lastUpdated = computed(() => data.value
  ? new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(data.value.checkedAt))
  : '–')

function paddedHistory(checkId: string) {
  const samples = data.value?.history[checkId] ?? []
  const padded: Array<HistorySample | null> = Array(Math.max(0, 30 - samples.length)).fill(null)
  return [...padded, ...samples.slice(-30)]
}

function healthCheckId(serviceId: string) {
  return data.value?.checks.find((check) => check.service === serviceId && check.kind === 'health')?.id ?? ''
}

function overallHistory() {
  const healthChecks = data.value?.checks.filter((check) => check.kind === 'health') ?? []
  const maxSamples = Math.max(0, ...healthChecks.map((check) => data.value?.history[check.id]?.length ?? 0))
  const result: Array<{ status: MonitorStatus; latencyMs: number } | null> = []
  for (let index = Math.max(0, maxSamples - 30); index < maxSamples; index++) {
    const samples = healthChecks.map((check) => data.value?.history[check.id]?.[index]).filter(Boolean) as HistorySample[]
    if (!samples.length) continue
    result.push({
      status: samples.some((sample) => sample.status === 'down') ? 'down' : samples.some((sample) => sample.status === 'degraded') ? 'degraded' : 'up',
      latencyMs: Math.round(samples.reduce((sum, sample) => sum + sample.latencyMs, 0) / samples.length)
    })
  }
  return [...Array(Math.max(0, 30 - result.length)).fill(null), ...result]
}

const statusLabel = (value: MonitorStatus) => value === 'up' ? 'Verfügbar' : value === 'degraded' ? 'Eingeschränkt' : 'Nicht erreichbar'
const capabilityLabel = (value: CapabilityStatus) => value === 'available' ? 'Verfügbar' : value === 'unconfigured' ? 'Nicht konfiguriert' : value === 'unavailable' ? 'Nicht installiert' : 'Problem'
const kindLabel = (value: CheckResult['kind']) => value === 'health' ? 'Health' : value === 'inventory' ? 'Inventar' : 'API'
const serviceName = (id: string) => data.value?.services.find((service) => service.id === id)?.name ?? id
</script>

<template>
  <div class="monitoring-page">
    <header class="page-head monitoring-head">
      <div>
        <p class="page-kicker">Live Operations</p>
        <h1>Platform Monitoring</h1>
        <p class="page-description">Verfügbarkeit, Antwortzeiten und Konfigurationsstatus aller Services, Endpunkte und KI-Komponenten.</p>
      </div>
      <div class="monitor-actions">
        <span class="auto-refresh"><i /> Automatisch alle 30 Sekunden</span>
        <button class="button-secondary" :disabled="forceRefreshing" @click="forceRefresh">
          <svg :class="{ spinning: forceRefreshing }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 11a8.1 8.1 0 1 0 2 5.3M20 4v7h-7"/></svg>
          {{ forceRefreshing ? 'Prüfe …' : 'Jetzt prüfen' }}
        </button>
      </div>
    </header>

    <div v-if="status === 'pending' && !data" class="monitor-loading card">
      <span class="loader" />
      <strong>Plattform wird geprüft …</strong>
      <p>Health-Endpunkte, AI-Provider und Safety-Tools werden parallel abgefragt.</p>
    </div>

    <div v-else-if="error && !data" class="gateway-outage card">
      <span class="outage-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
      </span>
      <div><strong>Monitoring-Gateway nicht erreichbar</strong><p>{{ api }}/monitoring antwortet nicht. Prüfe den Gateway-Container und Port 8080.</p></div>
      <button @click="refresh()">Erneut versuchen</button>
    </div>

    <template v-else-if="data">
      <section class="status-hero" :class="`status-hero--${data.status}`">
        <div class="hero-status">
          <span class="hero-pulse"><i /></span>
          <div>
            <p>Plattformstatus</p>
            <h2>{{ data.status === 'up' ? 'Alle kritischen Systeme erreichbar' : data.status === 'degraded' ? 'Einzelne Komponenten eingeschränkt' : 'Kritische Services nicht erreichbar' }}</h2>
            <span>Letzte Prüfung {{ lastUpdated }} Uhr · abgeschlossen in {{ data.durationMs }} ms</span>
          </div>
        </div>
        <div class="uptime-window">
          <div class="timeline-label"><span>Letzte 30 Prüfungen</span><strong>{{ data.summary.uptimePercent.toFixed(2) }}% Uptime</strong></div>
          <div class="uptime-bars">
            <i v-for="(sample, index) in overallHistory()" :key="index" :class="sample ? `bar--${sample.status}` : 'bar--empty'" :title="sample ? `${statusLabel(sample.status)} · Ø ${sample.latencyMs} ms` : 'Noch keine Messung'" />
          </div>
        </div>
      </section>

      <section class="monitor-kpis">
        <article class="monitor-kpi">
          <span class="kpi-symbol symbol--green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/></svg></span>
          <div><span>Services online</span><strong>{{ data.summary.servicesUp }}<small>/{{ data.summary.servicesTotal }}</small></strong><p>{{ data.summary.servicesUp === data.summary.servicesTotal ? 'Alle Services erreichbar' : `${data.summary.servicesTotal - data.summary.servicesUp} mit Problemen` }}</p></div>
        </article>
        <article class="monitor-kpi">
          <span class="kpi-symbol symbol--blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="9"/></svg></span>
          <div><span>Endpunkte verfügbar</span><strong>{{ data.summary.endpointsUp }}<small>/{{ data.summary.endpointsTotal }}</small></strong><p>{{ data.summary.endpointsTotal - data.summary.endpointsUp }} aktuell gestört</p></div>
        </article>
        <article class="monitor-kpi">
          <span class="kpi-symbol symbol--purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 9h.01M15 9h.01M9 15c2 1.4 4 1.4 6 0"/></svg></span>
          <div><span>AI & Safety verfügbar</span><strong>{{ data.summary.capabilitiesAvailable }}<small>/{{ data.summary.capabilitiesTotal }}</small></strong><p>{{ configurationGaps.length }} nicht einsatzbereit</p></div>
        </article>
        <article class="monitor-kpi">
          <span class="kpi-symbol symbol--amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9"/></svg></span>
          <div><span>Ø Antwortzeit</span><strong>{{ data.summary.averageLatencyMs }}<small>ms</small></strong><p>{{ data.summary.averageLatencyMs < 250 ? 'Sehr gute Performance' : data.summary.averageLatencyMs < 800 ? 'Im normalen Bereich' : 'Latenz prüfen' }}</p></div>
        </article>
      </section>

      <section class="monitor-grid">
        <article class="card services-card">
          <div class="section-head">
            <div><p class="section-kicker">Infrastruktur</p><h2>Services</h2></div>
            <span class="section-meta">{{ data.services.length }} überwacht</span>
          </div>
          <div class="service-list">
            <button
              v-for="service in data.services"
              :key="service.id"
              class="service-row"
              :class="{ 'service-row--active': activeService === service.id }"
              @click="activeService = activeService === service.id ? 'all' : service.id"
            >
              <span class="service-status-icon" :class="`service-status-icon--${service.status}`"><i /></span>
              <span class="service-info"><strong>{{ service.name }}</strong><small>{{ service.endpointsUp }}/{{ service.endpointsTotal }} Endpunkte · {{ service.capabilityIssues }} Konfigurationshinweise</small></span>
              <span class="mini-history">
                <i v-for="(sample, index) in paddedHistory(healthCheckId(service.id))" :key="index" :class="sample ? `bar--${sample.status}` : 'bar--empty'" />
              </span>
              <span class="service-latency"><strong>{{ service.latencyMs }} ms</strong><small>{{ service.uptimePercent.toFixed(2) }}%</small></span>
              <span class="status-pill" :class="service.status === 'up' ? 'status-ok' : service.status === 'degraded' ? 'status-warn' : 'status-error'">{{ statusLabel(service.status) }}</span>
            </button>
          </div>
        </article>

        <aside class="card issues-card">
          <div class="section-head">
            <div><p class="section-kicker section-kicker--issues">Attention</p><h2>Probleme & Hinweise</h2></div>
            <span class="issue-counter">{{ issueCount }}</span>
          </div>
          <div v-if="!issueCount" class="all-clear">
            <span>✓</span><strong>Keine offenen Probleme</strong><p>Alle Endpunkte und konfigurierten AI-Komponenten arbeiten normal.</p>
          </div>
          <div v-else class="issue-list">
            <div v-for="check in endpointIssues.slice(0, 4)" :key="check.id" class="issue-row issue-row--critical">
              <span class="issue-dot" />
              <div><strong>{{ check.name }} nicht erreichbar</strong><p>{{ serviceName(check.service) }} · {{ check.error ?? `HTTP ${check.statusCode}` }}</p></div>
            </div>
            <div v-for="capability in configurationGaps.slice(0, Math.max(0, 6 - endpointIssues.length))" :key="capability.id" class="issue-row">
              <span class="issue-dot" />
              <div><strong>{{ capability.name }}</strong><p>{{ capabilityLabel(capability.status) }} · {{ capability.detail }}</p></div>
            </div>
          </div>
        </aside>
      </section>

      <article class="card endpoints-card">
        <div class="section-head endpoint-head">
          <div><p class="section-kicker">Endpoint Monitoring</p><h2>Überwachte Endpunkte</h2></div>
          <div class="endpoint-filter">
            <button :class="{ active: activeService === 'all' }" @click="activeService = 'all'">Alle</button>
            <button v-for="service in data.services" :key="service.id" :class="{ active: activeService === service.id }" @click="activeService = service.id">{{ service.name }}</button>
          </div>
        </div>
        <div class="endpoint-table-wrap">
          <div class="endpoint-row endpoint-row--head"><span>Endpunkt</span><span>Service</span><span>Typ</span><span>Antwortzeit</span><span>HTTP</span><span>Status</span></div>
          <div v-for="check in sortedChecks" :key="check.id" class="endpoint-row">
            <span class="endpoint-name"><strong>{{ check.name }}</strong><code>{{ check.path }}</code></span>
            <span>{{ serviceName(check.service) }}</span>
            <span class="type-badge">{{ kindLabel(check.kind) }}</span>
            <span class="latency-value" :class="check.latencyMs > 1000 ? 'latency-slow' : check.latencyMs > 400 ? 'latency-medium' : ''">{{ check.latencyMs }} ms</span>
            <span>{{ check.statusCode ?? '–' }}</span>
            <span class="status-pill" :class="check.status === 'up' ? 'status-ok' : check.status === 'degraded' ? 'status-warn' : 'status-error'">{{ statusLabel(check.status) }}</span>
          </div>
        </div>
      </article>

      <article class="card ai-card">
        <div class="section-head">
          <div><p class="section-kicker">AI Landscape</p><h2>Provider & Modelle</h2></div>
          <span class="section-meta">Live aus dem Orchestrator</span>
        </div>
        <div class="provider-grid">
          <div v-for="provider in providers" :key="provider.id" class="provider-card" :class="`provider-card--${provider.status}`">
            <div class="provider-top">
              <span class="provider-logo">{{ provider.name.slice(0, 2).toUpperCase() }}</span>
              <span class="provider-state" :class="`provider-state--${provider.status}`"><i /> {{ capabilityLabel(provider.status) }}</span>
            </div>
            <h3>{{ provider.name }}</h3>
            <p>{{ provider.detail }}</p>
            <div class="model-list">
              <span v-for="model in providerModels(provider.id).slice(0, 5)" :key="model.id">{{ model.name }}</span>
              <span v-if="providerModels(provider.id).length > 5">+{{ providerModels(provider.id).length - 5 }} weitere</span>
              <small v-if="!providerModels(provider.id).length">Keine Modelle gemeldet</small>
            </div>
          </div>
        </div>
      </article>

      <article class="card capabilities-card">
        <div class="section-head">
          <div><p class="section-kicker">Capability Monitoring</p><h2>Safety-Engines & Tools</h2></div>
          <div class="capability-summary"><span class="cap-ready">{{ safetyCapabilities.filter((item) => item.status === 'available').length }} verfügbar</span><span>{{ safetyCapabilities.filter((item) => item.status !== 'available').length }} offen</span></div>
        </div>
        <div class="capability-grid">
          <div v-for="capability in safetyCapabilities" :key="capability.id" class="capability-item">
            <span class="capability-icon" :class="`capability-icon--${capability.status}`">{{ capability.category.slice(0, 2).toUpperCase() }}</span>
            <span class="capability-info"><strong>{{ capability.name }}</strong><small>{{ capability.category }} · {{ serviceName(capability.service) }}</small><p>{{ capability.detail }}</p></span>
            <span class="capability-status" :class="`capability-status--${capability.status}`"><i />{{ capabilityLabel(capability.status) }}</span>
          </div>
        </div>
      </article>
    </template>
  </div>
</template>

<style scoped>
.monitoring-head { align-items: center; }.monitor-actions { display: flex; align-items: center; gap: 13px; }.auto-refresh { display: flex; align-items: center; gap: 7px; color: var(--muted); font-size: 10px; }.auto-refresh i { width: 6px; height: 6px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 4px var(--ok-soft); }.monitor-actions button svg { width: 14px; }.spinning { animation: spin .8s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }
.monitor-loading { min-height: 300px; display: flex; align-items: center; justify-content: center; flex-direction: column; }.loader { width: 31px; height: 31px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; }.monitor-loading strong { margin-top: 15px; font-size: 13px; }.monitor-loading p { color: var(--muted); font-size: 10px; }
.gateway-outage { padding: 25px; display: flex; align-items: center; gap: 15px; border-color: #f2caca; }.outage-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 10px; color: var(--err); background: var(--err-soft); }.outage-icon svg { width: 21px; }.gateway-outage div { flex: 1; }.gateway-outage strong { font-size: 13px; }.gateway-outage p { margin: 4px 0 0; color: var(--muted); font-size: 10px; }
.status-hero { min-height: 137px; margin-bottom: 18px; padding: 25px 27px; display: flex; align-items: center; justify-content: space-between; gap: 30px; border-radius: 15px; background: linear-gradient(110deg, #0d1e3b, #17345f); color: #fff; box-shadow: 0 12px 30px rgba(9,28,58,.15); }.status-hero--degraded { background: linear-gradient(110deg, #2d2130, #5e4325); }.status-hero--down { background: linear-gradient(110deg, #351b28, #6b2930); }
.hero-status { display: flex; align-items: center; gap: 16px; }.hero-pulse { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 50%; background: rgba(53,219,151,.11); }.hero-pulse i { width: 14px; height: 14px; border: 3px solid rgba(255,255,255,.7); border-radius: 50%; background: #35db97; box-shadow: 0 0 0 7px rgba(53,219,151,.1); }.status-hero--degraded .hero-pulse i { background: #f0a43a; }.status-hero--down .hero-pulse i { background: #f06a6a; }
.hero-status p { margin: 0 0 4px; color: #7f93b1; font-size: 8.5px; font-weight: 800; letter-spacing: .9px; text-transform: uppercase; }.hero-status h2 { margin: 0; font-size: 18px; }.hero-status div > span { margin-top: 7px; display: block; color: #94a5bd; font-size: 9px; }
.uptime-window { width: min(440px, 40%); }.timeline-label { margin-bottom: 9px; display: flex; justify-content: space-between; color: #91a3be; font-size: 8.5px; }.timeline-label strong { color: #dfe8f5; }.uptime-bars, .mini-history { display: flex; gap: 3px; }.uptime-bars i { height: 29px; flex: 1; border-radius: 3px; }.bar--up { background: #35c98a; }.bar--degraded { background: #e9a23b; }.bar--down { background: #e65d63; }.bar--empty { background: rgba(148,163,184,.18); }
.monitor-kpis { margin-bottom: 18px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }.monitor-kpi { min-height: 115px; padding: 19px; display: flex; align-items: flex-start; gap: 13px; border: 1px solid var(--border); border-radius: 13px; background: #fff; box-shadow: var(--shadow-sm); }.kpi-symbol { width: 38px; height: 38px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 10px; }.kpi-symbol svg { width: 18px; }.symbol--green { color: var(--ok); background: var(--ok-soft); }.symbol--blue { color: var(--accent); background: var(--accent-soft); }.symbol--purple { color: var(--purple); background: var(--purple-soft); }.symbol--amber { color: var(--warn); background: var(--warn-soft); }.monitor-kpi div { display: flex; flex-direction: column; }.monitor-kpi div > span { color: var(--muted); font-size: 9.5px; font-weight: 600; }.monitor-kpi strong { margin-top: 3px; font-family: 'Manrope', sans-serif; font-size: 24px; line-height: 1.1; }.monitor-kpi strong small { margin-left: 3px; color: var(--muted-light); font-size: 10px; }.monitor-kpi p { margin: 7px 0 0; color: var(--muted); font-size: 8px; }
.monitor-grid { margin-bottom: 18px; display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(310px, .7fr); gap: 18px; }.services-card, .issues-card, .endpoints-card, .ai-card, .capabilities-card { padding: 0; overflow: hidden; }.section-head { min-height: 67px; padding: 17px 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); }.section-head h2 { margin: 3px 0 0; font-size: 15px; }.section-kicker { margin: 0; color: var(--muted-light); font-size: 8px; font-weight: 800; letter-spacing: .9px; text-transform: uppercase; }.section-kicker--issues { color: var(--warn); }.section-meta { color: var(--muted); font-size: 8.5px; }.issue-counter { min-width: 25px; height: 25px; display: grid; place-items: center; border-radius: 50%; color: var(--warn); background: var(--warn-soft); font-size: 9px; font-weight: 800; }
.service-list { padding: 0 18px 10px; }.service-row { width: 100%; min-height: 67px; padding: 8px 4px; display: flex; align-items: center; gap: 11px; border: 0; border-top: 1px solid var(--border); border-radius: 0; background: #fff; color: var(--text); text-align: left; }.service-row:first-child { border-top: 0; }.service-row:hover, .service-row--active { margin: 0 -8px; padding: 8px 12px; width: calc(100% + 16px); border-radius: 8px; background: var(--surface-soft); color: var(--text); transform: none; }.service-status-icon { width: 31px; height: 31px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 9px; background: var(--ok-soft); }.service-status-icon i { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 4px rgba(22,138,91,.1); }.service-status-icon--degraded { background: var(--warn-soft); }.service-status-icon--degraded i { background: var(--warn); }.service-status-icon--down { background: var(--err-soft); }.service-status-icon--down i { background: var(--err); }.service-info { min-width: 150px; display: flex; flex: 1; flex-direction: column; }.service-info strong { font-size: 10.5px; }.service-info small { margin-top: 3px; color: var(--muted); font-size: 7.5px; }.mini-history { width: 145px; gap: 2px; }.mini-history i { height: 14px; flex: 1; border-radius: 1px; }.mini-history .bar--empty { background: #e9edf3; }.service-latency { width: 58px; display: flex; flex-direction: column; align-items: flex-end; }.service-latency strong { font-size: 9px; }.service-latency small { margin-top: 2px; color: var(--muted); font-size: 7.5px; }.service-row .status-pill { min-width: 88px; justify-content: center; font-size: 7.5px; }
.issue-list { padding: 0 17px 11px; }.issue-row { min-height: 58px; display: flex; align-items: flex-start; gap: 9px; padding: 11px 2px; border-top: 1px solid var(--border); }.issue-row:first-child { border-top: 0; }.issue-dot { width: 7px; height: 7px; margin-top: 4px; flex: 0 0 auto; border-radius: 50%; background: var(--warn); }.issue-row--critical .issue-dot { background: var(--err); box-shadow: 0 0 0 4px var(--err-soft); }.issue-row strong { display: block; font-size: 9.5px; }.issue-row p { margin: 4px 0 0; display: -webkit-box; overflow: hidden; color: var(--muted); font-size: 7.8px; line-height: 1.4; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }.all-clear { min-height: 210px; display: flex; align-items: center; justify-content: center; flex-direction: column; text-align: center; }.all-clear > span { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; color: var(--ok); background: var(--ok-soft); font-size: 17px; }.all-clear strong { margin-top: 10px; font-size: 10px; }.all-clear p { max-width: 220px; margin: 5px 0; color: var(--muted); font-size: 8px; line-height: 1.5; }
.endpoints-card, .ai-card { margin-bottom: 18px; }.endpoint-head { gap: 20px; }.endpoint-filter { display: flex; gap: 4px; overflow-x: auto; }.endpoint-filter button { min-height: 26px; padding: 0 8px; flex: 0 0 auto; border-color: transparent; background: transparent; color: var(--muted); font-size: 7.5px; }.endpoint-filter button:hover { background: var(--surface-soft); color: var(--text); transform: none; }.endpoint-filter button.active { border-color: #ccdaf5; background: var(--accent-soft); color: var(--accent); }
.endpoint-table-wrap { overflow-x: auto; }.endpoint-row { min-width: 800px; min-height: 53px; padding: 8px 20px; display: grid; grid-template-columns: 1.5fr 1fr 70px 90px 55px 105px; align-items: center; gap: 12px; border-top: 1px solid var(--border); color: var(--muted); font-size: 8.5px; }.endpoint-row--head { min-height: 34px; border-top: 0; background: #fafbfd; color: var(--muted-light); font-size: 7px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; }.endpoint-name { min-width: 0; display: flex; flex-direction: column; }.endpoint-name strong { color: var(--text); font-size: 9px; }.endpoint-name code { width: fit-content; margin-top: 3px; padding: 0; overflow: hidden; background: transparent; color: var(--muted); font-size: 7.5px; text-overflow: ellipsis; white-space: nowrap; }.type-badge { width: fit-content; padding: 3px 6px; border-radius: 5px; background: #eef2f7; color: #5e6e83; font-size: 7px; font-weight: 700; }.latency-value { color: var(--ok); font-weight: 700; }.latency-medium { color: var(--warn); }.latency-slow { color: var(--err); }.endpoint-row .status-pill { justify-content: center; font-size: 7px; }
.provider-grid { padding: 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }.provider-card { min-height: 165px; padding: 15px; border: 1px solid var(--border); border-top: 3px solid var(--ok); border-radius: 10px; background: #fff; }.provider-card--unconfigured, .provider-card--unavailable { border-top-color: var(--warn); }.provider-card--issue { border-top-color: var(--err); }.provider-top { display: flex; align-items: center; justify-content: space-between; }.provider-logo { width: 31px; height: 31px; display: grid; place-items: center; border-radius: 8px; background: #132a4d; color: #fff; font-size: 8px; font-weight: 800; }.provider-state { display: flex; align-items: center; gap: 4px; color: var(--ok); font-size: 7px; font-weight: 700; }.provider-state i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }.provider-state--unconfigured, .provider-state--unavailable { color: var(--warn); }.provider-state--issue { color: var(--err); }.provider-card h3 { margin: 11px 0 0; font-size: 11px; }.provider-card > p { min-height: 25px; margin: 4px 0 10px; color: var(--muted); font-size: 7.5px; line-height: 1.5; }.model-list { display: flex; flex-wrap: wrap; gap: 4px; }.model-list span { max-width: 150px; padding: 3px 5px; overflow: hidden; border-radius: 4px; background: #f0f3f7; color: #5b697d; font-size: 6.5px; text-overflow: ellipsis; white-space: nowrap; }.model-list small { color: var(--muted-light); font-size: 7px; }
.capability-summary { display: flex; gap: 9px; color: var(--muted); font-size: 8px; }.capability-summary .cap-ready { color: var(--ok); }.capability-grid { padding: 10px 18px 16px; display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; }.capability-item { min-height: 70px; padding: 10px 2px; display: flex; align-items: flex-start; gap: 9px; border-top: 1px solid var(--border); }.capability-item:nth-child(-n+2) { border-top: 0; }.capability-icon { width: 30px; height: 30px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 8px; color: var(--ok); background: var(--ok-soft); font-size: 7px; font-weight: 800; }.capability-icon--unconfigured, .capability-icon--unavailable { color: var(--warn); background: var(--warn-soft); }.capability-icon--issue { color: var(--err); background: var(--err-soft); }.capability-info { min-width: 0; display: flex; flex: 1; flex-direction: column; }.capability-info strong { font-size: 9px; }.capability-info small { margin-top: 2px; color: var(--muted-light); font-size: 7px; }.capability-info p { margin: 4px 0 0; display: -webkit-box; overflow: hidden; color: var(--muted); font-size: 7.5px; line-height: 1.4; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }.capability-status { padding: 4px 6px; display: flex; align-items: center; gap: 4px; border-radius: 99px; color: var(--ok); background: var(--ok-soft); font-size: 6.5px; font-weight: 700; white-space: nowrap; }.capability-status i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }.capability-status--unconfigured, .capability-status--unavailable { color: var(--warn); background: var(--warn-soft); }.capability-status--issue { color: var(--err); background: var(--err-soft); }
@media (max-width: 1180px) { .monitor-kpis { grid-template-columns: 1fr 1fr; }.monitor-grid { grid-template-columns: 1fr; }.provider-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 760px) { .monitoring-head { align-items: flex-start; }.monitor-actions { width: 100%; align-items: stretch; flex-direction: column; }.auto-refresh { justify-content: center; }.status-hero { align-items: flex-start; flex-direction: column; }.uptime-window { width: 100%; }.monitor-kpis { grid-template-columns: 1fr; }.mini-history { display: none; }.service-info { min-width: 0; }.service-latency { display: none; }.provider-grid, .capability-grid { grid-template-columns: 1fr; }.capability-item:nth-child(2) { border-top: 1px solid var(--border); }.endpoint-head { align-items: flex-start; flex-direction: column; }.endpoint-filter { max-width: 100%; } }
@media (max-width: 480px) { .service-row .status-pill { min-width: 0; padding: 5px 7px; }.service-row .status-pill::before { display: none; }.hero-status { align-items: flex-start; }.hero-pulse { width: 38px; height: 38px; }.status-hero { padding: 21px; } }
</style>
