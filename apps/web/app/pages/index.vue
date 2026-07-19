<script setup lang="ts">
const config = useRuntimeConfig()
const {
  processes,
  totalSteps,
  aiEnabledSteps,
  coverage,
  assignedToolIds,
  openHighRisks,
  findTool
} = useProcessMap()

interface HealthResponse {
  status: string
  services: Record<string, { status: string }>
}

const { data, error, refresh, status } = await useFetch<HealthResponse>(
  `${config.public.apiBase}/health`,
  { server: false, lazy: true, credentials: 'include' }
)

const today = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
}).format(new Date())

const governanceScore = computed(() => {
  const steps = processes.value.flatMap((process) => process.steps)
  if (!steps.length) return 0
  const controlled = steps.filter((step) => step.control.trim().length > 12).length
  const highRiskSteps = steps.filter((step) => step.risk === 'high')
  const protectedHighRisks = highRiskSteps.filter((step) => step.humanApproval).length
  const controlScore = controlled / steps.length
  const approvalScore = highRiskSteps.length ? protectedHighRisks / highRiskSteps.length : 1
  return Math.round((controlScore * 0.55 + approvalScore * 0.45) * 100)
})

const onlineServices = computed(() => {
  if (!data.value?.services) return 0
  return Object.values(data.value.services).filter((service) => service.status === 'ok').length
})

const totalServices = computed(() => Object.keys(data.value?.services ?? {}).length)

const processCoverage = (process: (typeof processes.value)[number]) => {
  if (!process.steps.length) return 0
  return Math.round(process.steps.filter((step) => step.toolIds.length).length / process.steps.length * 100)
}

const processToolCount = (process: (typeof processes.value)[number]) =>
  new Set(process.steps.flatMap((step) => step.toolIds)).size

const attentionItems = computed(() => {
  const items: { level: 'high' | 'medium' | 'info'; title: string; detail: string; processId: string }[] = []

  for (const issue of openHighRisks.value.slice(0, 2)) {
    items.push({
      level: 'high',
      title: `Governance-Lücke: ${issue.step.title}`,
      detail: `${issue.process.name} · Kritischer Schritt ohne vollständige Tool-Abdeckung.`,
      processId: issue.process.id
    })
  }

  const pilotAssignments = processes.value.flatMap((process) => process.steps.flatMap((step) =>
    step.toolIds
      .map(findTool)
      .filter((tool) => tool?.status === 'pilot' && step.risk === 'high')
      .map((tool) => ({ process, step, tool }))
  ))

  if (pilotAssignments[0]) {
    items.push({
      level: 'medium',
      title: `${pilotAssignments[0].tool?.name} in kritischem Prozess`,
      detail: `${pilotAssignments[0].process.name} · Pilotstatus vor Produktivfreigabe prüfen.`,
      processId: pilotAssignments[0].process.id
    })
  }

  if (!items.length) {
    items.push({
      level: 'info',
      title: 'Keine akuten Handlungsfelder',
      detail: 'Alle kritischen Prozessschritte verfügen über dokumentierte Kontrollen.',
      processId: processes.value[0]?.id ?? ''
    })
  }
  return items.slice(0, 3)
})

const statusLabel = (status: string) => status === 'active' ? 'Produktiv' : status === 'pilot' ? 'Pilot' : 'Geplant'
</script>

<template>
  <div class="dashboard-page">
    <header class="page-head dashboard-head">
      <div>
        <p class="page-kicker">Executive Overview</p>
        <h1>AI Governance auf einen Blick</h1>
        <p class="page-description">Transparenz über KI-Einsatz, Prozessabdeckung und operative Risiken im gesamten Unternehmen.</p>
      </div>
      <div class="head-actions">
        <span class="report-date">{{ today }}</span>
        <NuxtLink to="/process-map" class="button">
          Prozesslandkarte ansehen
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6" /></svg>
        </NuxtLink>
      </div>
    </header>

    <section class="kpi-grid" aria-label="Management-Kennzahlen">
      <article class="kpi-card">
        <div class="kpi-icon kpi-icon--blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/></svg>
        </div>
        <div class="kpi-content">
          <span>Erfasste Prozesse</span>
          <strong>{{ processes.length }}</strong>
          <small><b>{{ processes.filter((p) => p.status === 'active').length }}</b> produktiv im Einsatz</small>
        </div>
      </article>

      <article class="kpi-card">
        <div class="kpi-icon kpi-icon--purple">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.5 6.5a4 4 0 0 0-5-5l2 2-3 3-2-2a4 4 0 0 0 5 5L19 17l-2 2-7.5-7.5"/></svg>
        </div>
        <div class="kpi-content">
          <span>Eingesetzte KI-Tools</span>
          <strong>{{ assignedToolIds.size }}</strong>
          <small><b>{{ aiEnabledSteps }}</b> von {{ totalSteps }} Schritten unterstützt</small>
        </div>
      </article>

      <article class="kpi-card">
        <div class="kpi-icon kpi-icon--green">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 4 5v6c0 5.2 3.3 9 8 11 4.7-2 8-5.8 8-11V5z"/><path d="m9 12 2 2 4-4"/></svg>
        </div>
        <div class="kpi-content">
          <span>Governance Score</span>
          <strong>{{ governanceScore }}<em>/100</em></strong>
          <small><b>Kontrollen</b> in allen Prozessen dokumentiert</small>
        </div>
      </article>

      <article class="kpi-card">
        <div class="kpi-icon" :class="openHighRisks.length ? 'kpi-icon--amber' : 'kpi-icon--green'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
        </div>
        <div class="kpi-content">
          <span>Handlungsfelder</span>
          <strong>{{ openHighRisks.length }}</strong>
          <small v-if="openHighRisks.length"><b>Priorisierung</b> im Governance Board</small>
          <small v-else><b>Keine</b> kritischen Lücken</small>
        </div>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="card portfolio-card">
        <div class="section-head">
          <div>
            <p class="section-kicker">Portfolio</p>
            <h2>Prozessabdeckung</h2>
          </div>
          <NuxtLink to="/process-map">Alle Prozesse <span>→</span></NuxtLink>
        </div>

        <div class="coverage-summary">
          <div class="score-ring" :style="{ '--score': `${coverage * 3.6}deg` }">
            <div><strong>{{ coverage }}%</strong><span>AI Coverage</span></div>
          </div>
          <div class="coverage-copy">
            <h3>{{ aiEnabledSteps }} von {{ totalSteps }} Prozessschritten sind KI-unterstützt</h3>
            <p>Zuweisung aktiver Modelle, Safety- und Monitoring-Tools über die gesamte Prozesslandschaft.</p>
            <div class="coverage-legend">
              <span><i class="legend-dot legend-dot--blue" /> KI-unterstützt</span>
              <span><i class="legend-dot" /> Manuell</span>
            </div>
          </div>
        </div>

        <div class="process-list">
          <NuxtLink
            v-for="process in processes"
            :key="process.id"
            :to="`/process-map?process=${process.id}`"
            class="process-row"
          >
            <div class="process-avatar">{{ process.name.slice(0, 2).toUpperCase() }}</div>
            <div class="process-main">
              <div class="process-title-line">
                <strong>{{ process.name }}</strong>
                <span class="status-pill" :class="process.status === 'active' ? 'status-ok' : process.status === 'pilot' ? 'status-warn' : 'status-neutral'">{{ statusLabel(process.status) }}</span>
              </div>
              <div class="progress-line"><span :style="{ width: `${processCoverage(process)}%` }" /></div>
            </div>
            <div class="process-stat"><strong>{{ processCoverage(process) }}%</strong><span>Abdeckung</span></div>
            <div class="process-stat"><strong>{{ processToolCount(process) }}</strong><span>Tools</span></div>
            <svg class="row-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
          </NuxtLink>
        </div>
      </article>

      <aside class="right-column">
        <article class="card attention-card">
          <div class="section-head">
            <div>
              <p class="section-kicker section-kicker--attention">Management Attention</p>
              <h2>Offene Punkte</h2>
            </div>
            <span class="attention-count">{{ attentionItems.length }}</span>
          </div>

          <div class="attention-list">
            <NuxtLink
              v-for="item in attentionItems"
              :key="item.title"
              :to="`/process-map?process=${item.processId}`"
              class="attention-item"
            >
              <span class="attention-marker" :class="`attention-marker--${item.level}`">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path v-if="item.level === 'info'" d="M12 8h.01M11 12h1v4h1"/><path v-else d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>
              </span>
              <span><strong>{{ item.title }}</strong><small>{{ item.detail }}</small></span>
              <span class="attention-arrow">→</span>
            </NuxtLink>
          </div>
        </article>

        <article class="card system-card">
          <div class="system-head">
            <div>
              <p class="section-kicker">Plattformstatus</p>
              <h2>Safety Services</h2>
            </div>
            <button class="refresh-button" :disabled="status === 'pending'" aria-label="Status aktualisieren" @click="refresh()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 11a8.1 8.1 0 1 0 2 5.3M20 4v7h-7"/></svg>
            </button>
          </div>
          <div v-if="error" class="system-state system-state--error"><span /> Gateway nicht erreichbar</div>
          <div v-else-if="status === 'pending'" class="system-state"><span class="pulse" /> Status wird geladen …</div>
          <div v-else class="system-state system-state--ok"><span /> {{ onlineServices }} von {{ totalServices }} Services online</div>
          <p>Technische Detailansicht und einzelne Kontrollen sind unter „Kontrollen & Tests“ verfügbar.</p>
        </article>
      </aside>
    </section>
  </div>
</template>

<style scoped>
.dashboard-head { align-items: center; }
.head-actions { display: flex; align-items: center; gap: 17px; }
.report-date { color: var(--muted); font-size: 13px; text-transform: capitalize; }
.button svg { width: 15px; }

.kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; margin-bottom: 28px; border: 1px solid var(--border-strong); background: var(--surface); }
.kpi-card { min-width: 0; min-height: 150px; padding: 24px; display: flex; align-items: flex-start; gap: 16px; background: var(--surface); border: 0; border-left: 1px solid var(--border-strong); border-radius: 0; box-shadow: none; }
.kpi-card:first-child { border-left: 0; }
.kpi-card:nth-child(even) { background: var(--surface-muted); }
.kpi-icon { width: 42px; height: 42px; flex: 0 0 auto; display: grid; place-items: center; border: 1px solid currentColor; border-radius: 0; }
.kpi-icon svg { width: 21px; }
.kpi-icon--blue { color: var(--accent); background: transparent; }
.kpi-icon--purple { color: var(--purple); background: var(--purple-soft); }
.kpi-icon--green { color: var(--ok); background: var(--ok-soft); }
.kpi-icon--amber { color: var(--warn); background: var(--warn-soft); }
.kpi-content { min-width: 0; display: flex; flex-direction: column; }
.kpi-content > span { margin-bottom: 6px; color: #4f4e48; font-size: 13px; font-weight: 650; }
.kpi-content > strong { color: var(--text); font-family: 'Space Grotesk', sans-serif; font-size: 32px; line-height: 1.05; letter-spacing: -1.6px; }
.kpi-content > strong em { margin-left: 2px; color: var(--muted-light); font-size: 12px; font-style: normal; letter-spacing: 0; }
.kpi-content small { margin-top: 8px; color: var(--muted); font-size: 12px; white-space: nowrap; }
.kpi-content small b { color: var(--ok); font-weight: 700; }

.dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(330px, .8fr); gap: 24px; align-items: start; }
.portfolio-card { padding: 0; overflow: hidden; }
.section-head { padding: 21px 22px 18px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-strong); background: var(--surface-soft); }
.section-head h2, .system-head h2 { margin: 3px 0 0; font-size: 19px; }
.section-head > a { color: #354dcc; font-size: 12.5px; font-weight: 750; text-decoration: none; }
.section-head > a span { margin-left: 4px; }
.section-kicker { margin: 0; color: #354dcc; font-size: 10.5px; font-weight: 800; letter-spacing: 1.05px; text-transform: uppercase; }
.section-kicker--attention { color: var(--warn); }

.coverage-summary { min-height: 174px; margin: 22px 22px 8px; padding: 22px 24px; display: flex; align-items: center; gap: 26px; border: 1px solid var(--ink); border-radius: 0; background: var(--acid); }
.score-ring { --score: 0deg; width: 105px; height: 105px; flex: 0 0 auto; padding: 8px; border-radius: 50%; background: conic-gradient(var(--ink) var(--score), rgba(23,23,20,.18) 0); }
.score-ring > div { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 50%; background: var(--acid); box-shadow: inset 0 0 0 1px var(--ink); }
.score-ring strong { font-family: 'Space Grotesk', sans-serif; font-size: 23px; letter-spacing: -1px; }
.score-ring span { margin-top: 2px; color: #4f4e48; font-size: 10.5px; font-weight: 750; text-transform: uppercase; }
.coverage-copy h3 { margin: 0 0 8px; font-size: 17px; letter-spacing: -0.2px; }
.coverage-copy p { max-width: 520px; margin: 0; color: #4f4e48; font-size: 13px; line-height: 1.6; }
.coverage-legend { margin-top: 16px; display: flex; gap: 18px; color: #4f4e48; font-size: 11.5px; font-weight: 650; }
.legend-dot { width: 7px; height: 7px; display: inline-block; margin-right: 5px; border-radius: 50%; background: #d5dce7; }
.legend-dot--blue { background: var(--ink); }

.process-list { padding: 7px 22px 13px; }
.process-row { min-height: 76px; display: flex; align-items: center; gap: 13px; border-top: 1px solid var(--border); text-decoration: none; transition: background 150ms; }
.process-row:hover { margin: 0 -10px; padding: 0 10px; border-radius: 0; background: var(--surface-soft); }
.process-avatar { width: 35px; height: 35px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 0; background: var(--ink); color: var(--acid); font-size: 9px; font-weight: 800; }
.process-main { min-width: 0; flex: 1; }
.process-title-line { display: flex; align-items: center; gap: 8px; }
.process-title-line > strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.process-title-line .status-pill { padding: 4px 7px; font-size: 10px; }
.process-title-line .status-pill::before { width: 4px; height: 4px; }
.progress-line { height: 4px; margin-top: 8px; overflow: hidden; border-radius: 2px; background: #e9edf3; }
.progress-line span { height: 100%; display: block; border-radius: inherit; background: var(--accent); }
.process-stat { width: 58px; display: flex; flex-direction: column; align-items: flex-end; }
.process-stat strong { font-size: 12.5px; }
.process-stat span { margin-top: 2px; color: var(--muted); font-size: 10px; }
.row-arrow { width: 15px; color: #9ca8b8; }

.right-column { display: grid; gap: 20px; }
.attention-card { padding: 0; overflow: hidden; }
.attention-count { min-width: 25px; height: 25px; display: grid; place-items: center; border: 1px solid var(--ink); border-radius: 50%; background: var(--acid); color: var(--ink); font-size: 10px; font-weight: 800; }
.attention-list { padding: 0 20px 12px; }
.attention-item { min-height: 72px; display: flex; align-items: center; gap: 11px; border-top: 1px solid var(--border); text-decoration: none; }
.attention-item > span:nth-child(2) { min-width: 0; flex: 1; }
.attention-item strong { display: block; font-size: 12.5px; line-height: 1.4; }
.attention-item small { margin-top: 4px; display: block; color: var(--muted); font-size: 11px; line-height: 1.45; }
.attention-marker { width: 28px; height: 28px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 0; }
.attention-marker svg { width: 15px; }
.attention-marker--high { color: var(--err); background: var(--err-soft); }
.attention-marker--medium { color: var(--warn); background: var(--warn-soft); }
.attention-marker--info { color: var(--ok); background: var(--ok-soft); }
.attention-arrow { color: #a9b2c0; font-size: 14px; }

.system-card { padding: 22px; background: var(--surface-muted); }
.system-head { display: flex; align-items: center; justify-content: space-between; }
.refresh-button { width: 32px; min-height: 32px; padding: 0; border-color: var(--border); background: var(--surface); color: var(--muted); }
.refresh-button:hover { border-color: var(--border-strong); background: var(--surface-soft); color: var(--text); }
.refresh-button svg { width: 14px; }
.system-state { margin-top: 17px; padding: 12px 13px; display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-strong); border-radius: 0; background: var(--surface); color: var(--muted); font-size: 12px; font-weight: 700; }
.system-state > span { width: 7px; height: 7px; border-radius: 50%; background: var(--muted-light); }
.system-state--ok { color: var(--ok); background: var(--ok-soft); }
.system-state--ok > span { background: var(--ok); }
.system-state--error { color: var(--err); background: var(--err-soft); }
.system-state--error > span { background: var(--err); }
.system-card > p { margin: 13px 2px 0; color: var(--muted); font-size: 11.5px; line-height: 1.6; }

@media (max-width: 1220px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .dashboard-grid { grid-template-columns: 1fr; }
  .right-column { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 720px) {
  .dashboard-head { align-items: flex-start; }
  .head-actions { width: 100%; align-items: stretch; flex-direction: column; }
  .report-date { order: 2; text-align: center; }
  .kpi-grid { grid-template-columns: 1fr; }
  .kpi-card { min-height: 112px; }
  .right-column { grid-template-columns: 1fr; }
  .coverage-summary { padding: 18px; align-items: flex-start; flex-direction: column; }
  .score-ring { align-self: center; }
  .process-stat { display: none; }
}
</style>
