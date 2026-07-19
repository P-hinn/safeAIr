<script setup lang="ts">
import type { LandscapeLayer, ProcessRelationType, WorkflowNodeType, WorkflowPosition } from '~/composables/useProcessMap'
import { createBpmn, parseBpmn } from '~/utils/bpmn'

const route = useRoute()
const {
  processes,
  tools,
  toggleTool,
  addProcess,
  addWorkflowStep,
  addConnection,
  removeConnection,
  removeStep,
  updateStepPosition,
  addImportedProcesses,
  addProcessRelation,
  removeProcessRelation,
  resetProcesses
} = useProcessMap()

const queryProcess = typeof route.query.process === 'string' ? route.query.process : ''
const selectedProcessId = ref(processes.value.some((process) => process.id === queryProcess) ? queryProcess : processes.value[0]?.id ?? '')
const viewMode = ref<'landscape' | 'workflow'>(queryProcess ? 'workflow' : 'landscape')
const selectedStepId = ref('')
const selectedEdgeId = ref('')
const toolFilter = ref('Alle')
const createOpen = ref(false)
const newProcessName = ref('')
const newProcessOwner = ref('')
const newProcessLayer = ref<LandscapeLayer>('core')
const newProcessDomain = ref('')
const bpmnInput = ref<HTMLInputElement>()
const transferNotice = ref<{ type: 'success' | 'error'; title: string; detail: string } | null>(null)
const relationOpen = ref(false)
const newRelationSource = ref('')
const newRelationTarget = ref('')
const newRelationType = ref<ProcessRelationType>('handoff')
const newRelationLabel = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined

const selectedProcess = computed(() => processes.value.find((process) => process.id === selectedProcessId.value))
const selectedStep = computed(() => selectedProcess.value?.steps.find((step) => step.id === selectedStepId.value))
const selectedEdge = computed(() => selectedProcess.value?.connections.find((edge) => edge.id === selectedEdgeId.value))
const categories = computed(() => ['Alle', ...new Set(tools.map((tool) => tool.category))])
const filteredTools = computed(() => toolFilter.value === 'Alle' ? tools : tools.filter((tool) => tool.category === toolFilter.value))

const selectedCoverage = computed(() => {
  if (!selectedProcess.value?.steps.length) return 0
  return Math.round(selectedProcess.value.steps.filter((step) => step.toolIds.length).length / selectedProcess.value.steps.length * 100)
})

const selectedToolCount = computed(() => new Set(selectedProcess.value?.steps.flatMap((step) => step.toolIds) ?? []).size)
const selectedHighRisks = computed(() => selectedProcess.value?.steps.filter((step) => step.risk === 'high').length ?? 0)
const selectedHumanControls = computed(() => selectedProcess.value?.steps.filter((step) => step.humanApproval).length ?? 0)

watch(selectedProcess, (process) => {
  selectedStepId.value = ''
  selectedEdgeId.value = ''
}, { immediate: true })

watch(newRelationSource, (sourceId) => {
  if (newRelationTarget.value !== sourceId) return
  newRelationTarget.value = processes.value.find((process) => process.id !== sourceId)?.id ?? ''
})

function selectProcess(id: string) {
  selectedProcessId.value = id
  viewMode.value = 'workflow'
}

function openNewProcess() {
  newProcessName.value = ''
  newProcessOwner.value = ''
  newProcessLayer.value = 'core'
  newProcessDomain.value = ''
  createOpen.value = true
}

function createProcess() {
  if (!newProcessName.value.trim()) return
  selectedProcessId.value = addProcess(
    newProcessName.value.trim(),
    newProcessOwner.value.trim(),
    newProcessLayer.value,
    newProcessDomain.value.trim()
  )
  viewMode.value = 'workflow'
  createOpen.value = false
}

function showNotice(type: 'success' | 'error', title: string, detail: string) {
  transferNotice.value = { type, title, detail }
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { transferNotice.value = null }, 6500)
}

function triggerBpmnImport() {
  bpmnInput.value?.click()
}

async function handleBpmnImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const result = parseBpmn(await file.text())
    const importedIds = addImportedProcesses(result.processes)
    selectedProcessId.value = importedIds[0] ?? selectedProcessId.value
    viewMode.value = 'landscape'
    const warningText = result.warnings.length ? ` ${result.warnings.length} Hinweis(e) beim Import.` : ''
    showNotice('success', 'BPMN erfolgreich importiert', `${result.processes.length} Prozess(e) aus „${file.name}“ zur Landschaft hinzugefügt.${warningText}`)
  } catch (error) {
    showNotice('error', 'BPMN-Import fehlgeschlagen', error instanceof Error ? error.message : 'Die Datei konnte nicht verarbeitet werden.')
  }
}

function exportBpmnFile() {
  try {
    const exportedProcesses = viewMode.value === 'workflow' && selectedProcess.value ? [selectedProcess.value] : processes.value
    const xml = createBpmn(exportedProcesses)
    const contextName = exportedProcesses.length === 1 ? exportedProcesses[0]?.name ?? 'prozess' : 'prozesslandschaft'
    const fileName = `${contextName.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '-').replace(/^-|-$/g, '') || 'prozesslandschaft'}.bpmn`
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
    showNotice('success', 'BPMN exportiert', `${exportedProcesses.length} Prozess(e) wurden inklusive Workflow-Positionen und Governance-Daten exportiert.`)
  } catch (error) {
    showNotice('error', 'BPMN-Export fehlgeschlagen', error instanceof Error ? error.message : 'Der Export konnte nicht erstellt werden.')
  }
}

function openRelationModal() {
  const source = selectedProcess.value ?? processes.value[0]
  newRelationSource.value = source?.id ?? ''
  newRelationTarget.value = processes.value.find((process) => process.id !== source?.id)?.id ?? ''
  newRelationType.value = 'handoff'
  newRelationLabel.value = ''
  relationOpen.value = true
}

function createProcessRelation() {
  if (!newRelationSource.value || !newRelationTarget.value || newRelationSource.value === newRelationTarget.value) return
  const relation = addProcessRelation(
    newRelationSource.value,
    newRelationTarget.value,
    newRelationType.value,
    newRelationLabel.value.trim()
  )
  if (!relation) return
  relationOpen.value = false
  showNotice('success', 'Prozesszusammenhang gespeichert', 'Die neue Übergabe ist direkt in der Prozesslandkarte sichtbar.')
}

function deleteProcessRelation(sourceId: string, relationId: string) {
  if (!confirm('Diesen Prozesszusammenhang entfernen?')) return
  removeProcessRelation(sourceId, relationId)
}

function selectStep(id: string) {
  selectedStepId.value = id
  selectedEdgeId.value = ''
}

function selectEdge(id: string) {
  selectedEdgeId.value = id
  selectedStepId.value = ''
}

function addNode(type: WorkflowNodeType) {
  if (!selectedProcess.value) return
  const step = addWorkflowStep(selectedProcess.value, type)
  selectedStepId.value = step.id
  selectedEdgeId.value = ''
}

function connectNodes(connection: { source: string; target: string; sourceHandle?: string | null }) {
  if (!selectedProcess.value) return
  const edge = addConnection(selectedProcess.value, connection)
  if (edge) selectEdge(edge.id)
}

function moveNode(id: string, position: WorkflowPosition) {
  if (selectedProcess.value) updateStepPosition(selectedProcess.value, id, position)
}

function deleteEdge(id = selectedEdgeId.value) {
  if (!selectedProcess.value || !id) return
  removeConnection(selectedProcess.value, id)
  if (selectedEdgeId.value === id) {
    selectedEdgeId.value = ''
    selectedStepId.value = selectedProcess.value.steps[0]?.id ?? ''
  }
}

function deleteStep() {
  if (!selectedProcess.value || !selectedStep.value) return
  if (!confirm(`Prozessschritt "${selectedStep.value.title}" und seine Verbindungen löschen?`)) return
  const deletedId = selectedStep.value.id
  const fallback = selectedProcess.value.steps.find((step) => step.id !== deletedId)?.id ?? ''
  if (removeStep(selectedProcess.value, deletedId)) selectedStepId.value = fallback
}

function stepTitle(id?: string) {
  return selectedProcess.value?.steps.find((step) => step.id === id)?.title ?? 'Unbekannter Schritt'
}

function restoreDemo() {
  if (!confirm('Eigene Änderungen verwerfen und die Demo-Prozesslandschaft wiederherstellen?')) return
  resetProcesses()
  selectedProcessId.value = processes.value[0]?.id ?? ''
  viewMode.value = 'landscape'
}

const statusLabel = (status: string) => status === 'active' ? 'Produktiv' : status === 'pilot' ? 'Pilot' : 'Geplant'
onBeforeUnmount(() => { if (noticeTimer) clearTimeout(noticeTimer) })
</script>

<template>
  <div class="process-page">
    <header class="page-head">
      <div>
        <p class="page-kicker">Business Process Intelligence</p>
        <h1>Prozesslandkarte</h1>
        <p class="page-description">Das gesamte Prozessportfolio steuern, in Workflows einsteigen und KI-Tools direkt den einzelnen Prozessschritten zuweisen.</p>
      </div>
      <div class="page-actions">
        <button class="button-secondary" @click="triggerBpmnImport">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
          BPMN importieren
        </button>
        <button class="button-secondary" @click="exportBpmnFile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 21h14"/></svg>
          BPMN exportieren
        </button>
        <button @click="openNewProcess">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Prozess hinzufügen
        </button>
        <input ref="bpmnInput" class="file-input" type="file" accept=".bpmn,.xml,application/xml,text/xml" @change="handleBpmnImport" />
      </div>
    </header>

    <section class="process-viewbar card">
      <div class="view-tabs">
        <button :class="{ active: viewMode === 'landscape' }" @click="viewMode = 'landscape'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          Prozesslandschaft
        </button>
        <button :class="{ active: viewMode === 'workflow' }" :disabled="!selectedProcess" @click="viewMode = 'workflow'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4a4 4 0 0 0 4-4V6M11 12a4 4 0 0 1 4 4v2"/></svg>
          Workflow-Designer
        </button>
      </div>
      <span class="view-context">
        <strong>{{ viewMode === 'landscape' ? 'Portfolio-Sicht' : selectedProcess?.name }}</strong>
        {{ viewMode === 'landscape' ? 'BPMN-Export umfasst alle Prozesse' : 'BPMN-Export umfasst diesen Prozess' }}
      </span>
      <button class="reset-link" @click="restoreDemo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
        Demo zurücksetzen
      </button>
    </section>

    <ProcessLandscape
      v-if="viewMode === 'landscape'"
      :processes="processes"
      @open-process="selectProcess"
      @create-relation="openRelationModal"
      @remove-relation="deleteProcessRelation"
    />

    <section v-if="viewMode === 'workflow'" class="process-switcher card">
      <div class="switcher-copy">
        <span>Prozesslandschaft</span>
        <strong>{{ processes.length }} Geschäftsprozesse</strong>
      </div>
      <div class="process-tabs">
        <button
          v-for="process in processes"
          :key="process.id"
          class="process-tab"
          :class="{ 'process-tab--active': process.id === selectedProcessId }"
          @click="selectProcess(process.id)"
        >
          <span class="tab-status" :class="`tab-status--${process.status}`" />
          {{ process.name }}
        </button>
      </div>
      <select v-model="selectedProcessId" class="process-select" aria-label="Prozess auswählen">
        <option v-for="process in processes" :key="process.id" :value="process.id">{{ process.name }}</option>
      </select>
    </section>

    <template v-if="viewMode === 'workflow' && selectedProcess">
      <section class="process-hero">
        <div class="process-heading">
          <div class="process-symbol">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h10M4 18h16"/><circle cx="17" cy="12" r="3"/></svg>
          </div>
          <div>
            <div class="process-name-line">
              <h2>{{ selectedProcess.name }}</h2>
              <select v-model="selectedProcess.status" class="status-select" :class="`status-select--${selectedProcess.status}`">
                <option value="active">Produktiv</option>
                <option value="pilot">Pilot</option>
                <option value="planned">Geplant</option>
              </select>
            </div>
            <p>{{ selectedProcess.description }}</p>
            <span>Process Owner: <strong>{{ selectedProcess.owner }}</strong> · {{ selectedProcess.volume }}</span>
            <div class="process-classification">
              <label>
                <span>Federführende Abteilung</span>
                <input v-model="selectedProcess.domain" placeholder="z. B. Customer Operations" />
              </label>
              <label>
                <span>Prozessebene</span>
                <select v-model="selectedProcess.landscapeLayer">
                  <option value="management">Steuerungsprozess</option>
                  <option value="core">Kernprozess</option>
                  <option value="support">Unterstützungsprozess</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div class="process-metrics">
          <div><strong>{{ selectedCoverage }}%</strong><span>AI Coverage</span></div>
          <div><strong>{{ selectedToolCount }}</strong><span>KI-Tools</span></div>
          <div><strong>{{ selectedHighRisks }}</strong><span>Hohe Risiken</span></div>
          <div><strong>{{ selectedHumanControls }}</strong><span>Human Controls</span></div>
        </div>
      </section>

      <section class="map-layout" :class="{ 'map-layout--detail': selectedStep || selectedEdge }">
        <div class="map-column">
          <article class="card map-card">
            <div class="map-head">
              <div>
                <p class="section-kicker">Visueller Prozessaufbau</p>
                <h2>Workflow-Designer</h2>
              </div>
              <div class="map-legend">
                <span><i class="node-dot node-dot--ai" /> KI-Schritt</span>
                <span><i class="node-dot node-dot--decision" /> Entscheidung</span>
                <span><i class="node-dot node-dot--approval" /> Freigabe</span>
              </div>
            </div>

            <ClientOnly>
              <WorkflowCanvas
                :process="selectedProcess"
                :selected-step-id="selectedStepId"
                :selected-edge-id="selectedEdgeId"
                @select-step="selectStep"
                @select-edge="selectEdge"
                @connect="connectNodes"
                @move="moveNode"
                @remove-edge="deleteEdge"
                @add-node="addNode"
              />
              <template #fallback><div class="canvas-loading">Workflow-Designer wird geladen …</div></template>
            </ClientOnly>

            <div class="map-insight">
              <span class="insight-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
              </span>
              <div><strong>Management-Hinweis</strong><p>{{ selectedCoverage }}% der Schritte sind mit KI- oder Safety-Tools verknüpft. Der Workflow enthält {{ selectedProcess.connections.length }} logische Verbindungen und {{ selectedHighRisks }} Schritte mit hohem Risiko.</p></div>
            </div>
          </article>

          <article class="card responsibility-card">
            <div class="map-head">
              <div><p class="section-kicker">Governance</p><h2>Verantwortungsmatrix</h2></div>
            </div>
            <div class="responsibility-table">
              <div class="responsibility-row responsibility-row--head"><span>Prozessschritt</span><span>Verantwortlich</span><span>Kontrolle</span><span>Freigabe</span></div>
              <div v-for="step in selectedProcess.steps" :key="step.id" class="responsibility-row" @click="selectStep(step.id)">
                <strong>{{ step.title }}</strong>
                <span>{{ step.owner }}</span>
                <span class="control-text">{{ step.control }}</span>
                <span><i :class="step.humanApproval ? 'check-yes' : 'check-no'">{{ step.humanApproval ? '✓' : '–' }}</i></span>
              </div>
            </div>
          </article>
        </div>

        <aside v-if="selectedStep || selectedEdge" class="card detail-panel">
          <template v-if="selectedStep">
          <div class="detail-head">
            <div>
              <p class="section-kicker">Prozessschritt konfigurieren</p>
              <h2>{{ selectedStep.title }}</h2>
            </div>
            <div class="detail-actions">
              <span class="autosave"><i /> Gespeichert</span>
              <button class="delete-icon" title="Prozessschritt löschen" @click="deleteStep">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></svg>
              </button>
            </div>
          </div>

          <div class="form-grid">
            <label class="field"><span>Workflow-Typ</span>
              <select v-model="selectedStep.workflowType">
                <option value="trigger">Auslöser</option>
                <option value="task">Aufgabe</option>
                <option value="ai">KI-Verarbeitung</option>
                <option value="decision">Entscheidung</option>
                <option value="approval">Freigabe</option>
                <option value="end">Prozessende</option>
              </select>
            </label>
            <label class="field"><span>Risikostufe</span>
              <select v-model="selectedStep.risk"><option value="low">Niedrig</option><option value="medium">Mittel</option><option value="high">Hoch</option></select>
            </label>
            <label class="field field--full"><span>Bezeichnung</span><input v-model="selectedStep.title" /></label>
            <label class="field field--full"><span>Beschreibung</span><textarea v-model="selectedStep.description" rows="3" /></label>
            <label class="field"><span>Verantwortlich</span><input v-model="selectedStep.owner" /></label>
            <label class="field"><span>Bereich</span><input v-model="selectedStep.department" /></label>
            <label class="toggle-field">
              <span><strong>Human-in-the-Loop</strong><small>Manuelle Prüfung erforderlich</small></span>
              <input v-model="selectedStep.humanApproval" type="checkbox" />
              <i />
            </label>
            <label class="field field--full"><span>Kontrollmaßnahme</span><textarea v-model="selectedStep.control" rows="2" /></label>
          </div>

          <div class="tool-assignment">
            <div class="assignment-head">
              <div><h3>KI-Tools zuweisen</h3><span>{{ selectedStep.toolIds.length }} ausgewählt</span></div>
            </div>
            <div class="category-filter">
              <button v-for="category in categories" :key="category" :class="{ active: toolFilter === category }" @click="toolFilter = category">{{ category }}</button>
            </div>
            <div class="tool-list">
              <label v-for="tool in filteredTools" :key="tool.id" class="tool-option" :class="{ 'tool-option--selected': selectedStep.toolIds.includes(tool.id) }">
                <input type="checkbox" :checked="selectedStep.toolIds.includes(tool.id)" @change="toggleTool(selectedStep, tool.id)" />
                <span class="tool-logo" :style="{ background: tool.color }">{{ tool.initials }}</span>
                <span class="tool-info"><strong>{{ tool.name }}</strong><small>{{ tool.vendor }} · {{ tool.category }}</small></span>
                <span class="tool-status" :class="`tool-status--${tool.status}`">{{ statusLabel(tool.status) }}</span>
                <span class="custom-check">✓</span>
              </label>
            </div>
          </div>
          </template>

          <template v-else-if="selectedEdge">
            <div class="detail-head">
              <div>
                <p class="section-kicker">Workflow-Logik</p>
                <h2>Verbindung bearbeiten</h2>
              </div>
              <span class="autosave"><i /> Gespeichert</span>
            </div>
            <div class="edge-editor">
              <div class="edge-route">
                <span class="edge-node"><small>Von</small><strong>{{ stepTitle(selectedEdge?.source) }}</strong></span>
                <span class="edge-route-line"><i />→</span>
                <span class="edge-node"><small>Nach</small><strong>{{ stepTitle(selectedEdge?.target) }}</strong></span>
              </div>
              <label class="field"><span>Bedingung</span>
                <select v-model="selectedEdge.condition">
                  <option value="always">Immer ausführen</option>
                  <option value="yes">Wenn Ja / erfüllt</option>
                  <option value="no">Wenn Nein / nicht erfüllt</option>
                  <option value="fallback">Fallback / bei Fehler</option>
                </select>
              </label>
              <label class="field"><span>Beschriftung</span><input v-model="selectedEdge.label" placeholder="z. B. Freigegeben" /></label>
              <div class="logic-hint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
                <p>Entscheidungs-Nodes besitzen getrennte Ausgänge für „Ja“ und „Nein“. Ziehe vom jeweiligen Anschluss zum nächsten Schritt.</p>
              </div>
              <button class="button-danger edge-delete" @click="deleteEdge()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/></svg>
                Verbindung löschen
              </button>
            </div>
          </template>
        </aside>
      </section>
    </template>

    <div v-if="createOpen" class="modal-backdrop" @click.self="createOpen = false">
      <form class="create-modal" @submit.prevent="createProcess">
        <div class="modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></svg></div>
        <h2>Geschäftsprozess hinzufügen</h2>
        <p>Lege einen neuen Prozess an. Schritte und KI-Tools kannst du anschließend direkt in der Prozesslandkarte ergänzen.</p>
        <label class="field"><span>Prozessname</span><input v-model="newProcessName" autofocus placeholder="z. B. Rechnungsverarbeitung" /></label>
        <label class="field"><span>Process Owner</span><input v-model="newProcessOwner" placeholder="z. B. Leitung Finance" /></label>
        <div class="modal-field-row">
          <label class="field"><span>Ebene der Prozesslandkarte</span>
            <select v-model="newProcessLayer">
              <option value="management">Steuerungsprozess</option>
              <option value="core">Kernprozess</option>
              <option value="support">Unterstützungsprozess</option>
            </select>
          </label>
          <label class="field"><span>Prozessdomäne</span><input v-model="newProcessDomain" placeholder="z. B. Finance" /></label>
        </div>
        <div class="modal-actions"><button type="button" class="button-secondary" @click="createOpen = false">Abbrechen</button><button :disabled="!newProcessName.trim()" type="submit">Prozess anlegen</button></div>
      </form>
    </div>

    <div v-if="relationOpen" class="modal-backdrop" @click.self="relationOpen = false">
      <form class="create-modal relation-modal" @submit.prevent="createProcessRelation">
        <div class="modal-icon modal-icon--relation">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4a4 4 0 0 0 4-4V6M11 12a4 4 0 0 1 4 4v2"/></svg>
        </div>
        <h2>Prozesszusammenhang anlegen</h2>
        <p>Dokumentiere eine Übergabe, Steuerungsbeziehung, Unterstützung oder einen Datenfluss zwischen zwei Geschäftsprozessen.</p>
        <div class="relation-form-route">
          <label class="field"><span>Quellprozess</span>
            <select v-model="newRelationSource">
              <option v-for="process in processes" :key="process.id" :value="process.id">{{ process.domain }} · {{ process.name }}</option>
            </select>
          </label>
          <span>→</span>
          <label class="field"><span>Zielprozess</span>
            <select v-model="newRelationTarget">
              <option v-for="process in processes.filter((item) => item.id !== newRelationSource)" :key="process.id" :value="process.id">{{ process.domain }} · {{ process.name }}</option>
            </select>
          </label>
        </div>
        <label class="field relation-type-field"><span>Art des Zusammenhangs</span>
          <select v-model="newRelationType">
            <option value="handoff">Übergabe – Ergebnis geht in den nächsten Prozess</option>
            <option value="governance">Governance – Vorgaben, Kontrolle oder Freigabe</option>
            <option value="support">Unterstützung – Fähigkeit oder Ressource bereitstellen</option>
            <option value="data">Datenfluss – Informationen oder Reporting übergeben</option>
          </select>
        </label>
        <label class="field"><span>Was wird übergeben oder bereitgestellt?</span><input v-model="newRelationLabel" placeholder="z. B. Freigegebene Kundendaten" /></label>
        <div class="modal-actions"><button type="button" class="button-secondary" @click="relationOpen = false">Abbrechen</button><button :disabled="!newRelationSource || !newRelationTarget || newRelationSource === newRelationTarget" type="submit">Zusammenhang speichern</button></div>
      </form>
    </div>

    <Transition name="notice">
      <div v-if="transferNotice" class="transfer-notice" :class="`transfer-notice--${transferNotice.type}`">
        <span class="notice-icon">
          <svg v-if="transferNotice.type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 12 4 4 8-9"/><circle cx="12" cy="12" r="9"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>
        </span>
        <span><strong>{{ transferNotice.title }}</strong><small>{{ transferNotice.detail }}</small></span>
        <button aria-label="Hinweis schließen" @click="transferNotice = null">×</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.page-actions { display: flex; gap: 10px; }
.page-actions svg { width: 15px; }
.file-input { display: none; }
.process-viewbar { min-height: 58px; margin-bottom: 20px; padding: 7px 9px; display: flex; align-items: center; gap: 15px; }
.view-tabs { display: flex; padding: 3px; gap: 3px; border-radius: 9px; background: #f0f3f7; }.view-tabs button { min-height: 36px; padding: 0 13px; border-color: transparent; background: transparent; color: var(--muted); font-size: 9px; }.view-tabs button:hover { border-color: transparent; background: rgba(255,255,255,.65); color: var(--text); transform: none; }.view-tabs button.active { border-color: #dbe3ee; background: #fff; color: var(--accent); box-shadow: 0 2px 7px rgba(20,34,56,.07); }.view-tabs button:disabled { opacity: .45; }.view-tabs svg { width: 14px; }
.view-context { min-width: 0; display: flex; flex-direction: column; color: var(--muted-light); font-size: 7.5px; }.view-context strong { margin-bottom: 2px; overflow: hidden; color: var(--text); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.reset-link { margin-left: auto; min-height: 33px; padding: 0 9px; border-color: transparent; background: transparent; color: var(--muted); font-size: 8px; }.reset-link:hover { border-color: transparent; background: var(--surface-soft); color: var(--text); transform: none; }.reset-link svg { width: 12px; }
.process-switcher { min-height: 66px; margin-bottom: 20px; padding: 8px 10px 8px 18px; display: flex; align-items: center; gap: 18px; }
.switcher-copy { min-width: 145px; display: flex; flex-direction: column; }
.switcher-copy span { color: var(--muted-light); font-size: 9px; font-weight: 700; letter-spacing: .7px; text-transform: uppercase; }
.switcher-copy strong { margin-top: 3px; font-size: 11px; }
.process-tabs { min-width: 0; display: flex; gap: 4px; overflow-x: auto; }
.process-tab { min-height: 42px; padding: 0 13px; flex: 0 0 auto; border-color: transparent; background: transparent; color: var(--muted); font-size: 10.5px; font-weight: 600; }
.process-tab:hover { border-color: transparent; background: var(--surface-soft); color: var(--text); transform: none; }
.process-tab--active, .process-tab--active:hover { border-color: #d6e2f8; background: var(--accent-soft); color: var(--accent); }
.tab-status { width: 6px; height: 6px; border-radius: 50%; background: var(--muted-light); }
.tab-status--active { background: var(--ok); }.tab-status--pilot { background: var(--warn); }.tab-status--planned { background: var(--muted-light); }
.process-select { display: none; width: 100%; min-height: 42px; padding: 0 10px; }

.process-hero { margin-bottom: 20px; padding: 21px 23px; display: flex; align-items: center; justify-content: space-between; gap: 24px; border-radius: 14px; background: linear-gradient(110deg, #101f3d, #142b54); color: #fff; box-shadow: 0 9px 24px rgba(11,23,48,.16); }
.process-heading { min-width: 0; display: flex; align-items: center; gap: 15px; }
.process-symbol { width: 45px; height: 45px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 11px; background: rgba(255,255,255,.09); color: #8db4ff; }
.process-symbol svg { width: 23px; }
.process-name-line { display: flex; align-items: center; gap: 10px; }
.process-name-line h2 { margin: 0; font-size: 18px; }
.process-heading p { max-width: 600px; margin: 5px 0; color: #aebbd0; font-size: 10.5px; line-height: 1.45; }
.process-heading > div > span { color: #8091ab; font-size: 9.5px; }
.process-heading > div > span strong { color: #c8d3e4; }
.process-classification { margin-top: 10px; display: flex; gap: 7px; }.process-classification label { min-width: 150px; display: flex; flex-direction: column; gap: 3px; }.process-classification label > span { color: #7f91ad; font-size: 6.5px; font-weight: 700; letter-spacing: .45px; text-transform: uppercase; }.process-classification input, .process-classification select { min-height: 29px; padding: 0 8px; border-color: rgba(255,255,255,.13); background-color: rgba(255,255,255,.08); color: #dbe5f5; font-size: 8px; }.process-classification input::placeholder { color: #71829d; }.process-classification select option { color: var(--text); }
.status-select { min-height: 25px; padding: 0 22px 0 8px; border: 1px solid rgba(255,255,255,.12); border-radius: 999px; color: #fff; background: rgba(255,255,255,.08); font-size: 8.5px; font-weight: 700; }
.status-select option { color: var(--text); }
.process-metrics { display: flex; flex: 0 0 auto; }
.process-metrics > div { min-width: 79px; padding: 2px 15px; display: flex; flex-direction: column; border-left: 1px solid rgba(255,255,255,.1); }
.process-metrics strong { font-family: 'Manrope', sans-serif; font-size: 18px; }
.process-metrics span { margin-top: 3px; color: #8495af; font-size: 8px; white-space: nowrap; }

.map-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; }
.map-layout--detail { grid-template-columns: minmax(0, 1fr) 350px; }
.map-column { min-width: 0; display: grid; gap: 20px; }
.map-card { min-width: 0; padding: 0; overflow: hidden; }
.map-head { min-height: 67px; padding: 17px 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); }
.section-kicker { margin: 0; color: var(--muted-light); font-size: 8.5px; font-weight: 700; letter-spacing: .9px; text-transform: uppercase; }
.map-head h2 { margin: 3px 0 0; font-size: 15px; }
.map-legend { display: flex; gap: 13px; color: var(--muted); font-size: 8.5px; font-weight: 600; }
.node-dot { width: 7px; height: 7px; display: inline-block; margin-right: 4px; border-radius: 2px; }.node-dot--ai { background: var(--purple); }.node-dot--decision { background: var(--warn); transform: rotate(45deg); }.node-dot--approval { background: var(--accent); }
.canvas-loading { height: 590px; display: grid; place-items: center; background: var(--surface-soft); color: var(--muted); font-size: 11px; }
.map-insight { margin: 0 20px 20px; padding: 12px 14px; display: flex; gap: 11px; border: 1px solid #dce7fb; border-radius: 9px; background: #f5f8ff; }
.insight-icon { width: 27px; height: 27px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 7px; background: #e4edff; color: var(--accent); }.insight-icon svg { width: 15px; }
.map-insight strong { font-size: 9.5px; }.map-insight p { margin: 3px 0 0; color: var(--muted); font-size: 8.5px; line-height: 1.45; }

.responsibility-card { padding: 0; overflow: hidden; }
.responsibility-table { overflow-x: auto; }
.responsibility-row { min-width: 660px; min-height: 50px; padding: 9px 20px; display: grid; grid-template-columns: 1.1fr .9fr 1.7fr 55px; align-items: center; gap: 14px; border-top: 1px solid var(--border); color: var(--muted); font-size: 9px; cursor: pointer; }
.responsibility-row:hover { background: var(--surface-soft); }.responsibility-row--head { min-height: 34px; border-top: 0; background: #fafbfc; color: var(--muted-light); font-size: 7.5px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; cursor: default; }
.responsibility-row strong { color: var(--text); font-size: 9.5px; }.control-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.check-yes, .check-no { width: 20px; height: 20px; display: grid; place-items: center; border-radius: 50%; font-size: 9px; font-style: normal; }.check-yes { color: var(--ok); background: var(--ok-soft); }.check-no { color: var(--muted); background: #f0f2f5; }

.detail-panel { position: sticky; top: 90px; padding: 0; overflow: hidden; }
.detail-head { padding: 18px 18px 15px; display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 1px solid var(--border); }
.detail-head h2 { margin: 3px 0 0; font-size: 15px; }.autosave { display: flex; align-items: center; gap: 5px; color: var(--ok); font-size: 8px; font-weight: 700; }.autosave i { width: 5px; height: 5px; border-radius: 50%; background: var(--ok); }
.detail-actions { display: flex; align-items: center; gap: 7px; }
.delete-icon { width: 28px; min-height: 28px; padding: 0; border-color: transparent; background: transparent; color: var(--muted-light); }.delete-icon:hover { border-color: transparent; background: var(--err-soft); color: var(--err); transform: none; }.delete-icon svg { width: 14px; }
.form-grid { padding: 16px 18px 5px; display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
.field { min-width: 0; display: flex; flex-direction: column; gap: 5px; }.field--full { grid-column: 1 / -1; }.field > span { color: var(--muted); font-size: 8.5px; font-weight: 700; }.field input, .field select, .field textarea { width: 100%; min-height: 34px; padding: 8px 9px; font-size: 9.5px; }.field textarea { resize: vertical; }
.toggle-field { min-height: 48px; position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; }.toggle-field > span { display: flex; flex-direction: column; }.toggle-field strong { font-size: 8.5px; }.toggle-field small { margin-top: 2px; color: var(--muted); font-size: 7.5px; }.toggle-field input { position: absolute; opacity: 0; }.toggle-field i { width: 31px; height: 17px; position: relative; flex: 0 0 auto; border-radius: 9px; background: #d7dde6; transition: 150ms; }.toggle-field i::after { content: ''; position: absolute; top: 3px; left: 3px; width: 11px; height: 11px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.18); transition: 150ms; }.toggle-field input:checked + i { background: var(--accent); }.toggle-field input:checked + i::after { transform: translateX(14px); }
.tool-assignment { margin-top: 10px; padding: 15px 18px 18px; border-top: 1px solid var(--border); }.assignment-head > div { display: flex; align-items: center; justify-content: space-between; }.assignment-head h3 { margin: 0; font-size: 11px; }.assignment-head span { color: var(--muted); font-size: 8px; }
.category-filter { margin: 11px -2px 9px; padding-bottom: 3px; display: flex; gap: 4px; overflow-x: auto; }.category-filter button { min-height: 25px; padding: 0 7px; flex: 0 0 auto; border-color: transparent; background: transparent; color: var(--muted); font-size: 7.5px; }.category-filter button:hover { background: var(--surface-soft); color: var(--text); transform: none; }.category-filter button.active { border-color: #cfddf6; background: var(--accent-soft); color: var(--accent); }
.tool-list { max-height: 286px; display: grid; gap: 5px; overflow-y: auto; }.tool-option { min-height: 47px; padding: 7px 8px; display: flex; align-items: center; gap: 8px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: 140ms; }.tool-option:hover { border-color: #becde2; }.tool-option--selected { border-color: #a9c5fb; background: #f6f9ff; }.tool-option > input { position: absolute; opacity: 0; }.tool-logo { width: 28px; height: 28px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 7px; color: #fff; font-size: 7px; font-weight: 800; }.tool-info { min-width: 0; flex: 1; }.tool-info strong { display: block; font-size: 9px; }.tool-info small { margin-top: 2px; display: block; overflow: hidden; color: var(--muted); font-size: 7.5px; text-overflow: ellipsis; white-space: nowrap; }.tool-status { padding: 3px 5px; border-radius: 999px; font-size: 6.5px; font-weight: 700; }.tool-status--active { color: var(--ok); background: var(--ok-soft); }.tool-status--pilot { color: var(--warn); background: var(--warn-soft); }.tool-status--planned { color: var(--muted); background: #f0f2f5; }.custom-check { width: 17px; height: 17px; display: grid; place-items: center; border: 1px solid #cdd5e0; border-radius: 5px; color: transparent; font-size: 9px; }.tool-option--selected .custom-check { border-color: var(--accent); background: var(--accent); color: #fff; }

.edge-editor { padding: 18px; display: grid; gap: 15px; }
.edge-route { padding: 13px; display: grid; grid-template-columns: 1fr 35px 1fr; align-items: center; gap: 7px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-soft); }
.edge-node { min-width: 0; display: flex; flex-direction: column; }.edge-node small { color: var(--muted-light); font-size: 7px; font-weight: 700; text-transform: uppercase; }.edge-node strong { margin-top: 3px; overflow: hidden; font-size: 8.5px; text-overflow: ellipsis; white-space: nowrap; }
.edge-route-line { display: flex; align-items: center; color: var(--accent); font-size: 11px; }.edge-route-line i { width: 22px; height: 1px; background: #9db9ef; }
.logic-hint { padding: 10px; display: flex; gap: 8px; border-radius: 8px; background: var(--accent-soft); color: var(--accent); }.logic-hint svg { width: 15px; flex: 0 0 auto; }.logic-hint p { margin: 0; font-size: 7.8px; line-height: 1.5; }
.edge-delete { width: 100%; }.edge-delete svg { width: 14px; }

.modal-backdrop { position: fixed; z-index: 100; inset: 0; padding: 20px; display: grid; place-items: center; background: rgba(7,18,39,.58); backdrop-filter: blur(4px); }.create-modal { width: min(440px, 100%); padding: 28px; border-radius: 16px; background: #fff; box-shadow: 0 24px 60px rgba(0,0,0,.22); }.modal-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 11px; background: var(--accent-soft); color: var(--accent); }.modal-icon svg { width: 22px; }.create-modal h2 { margin: 16px 0 7px; font-size: 19px; }.create-modal > p { margin: 0 0 20px; color: var(--muted); font-size: 11px; line-height: 1.55; }.create-modal > .field { margin-top: 12px; }.create-modal > .field input { min-height: 40px; font-size: 11px; }.modal-actions { margin-top: 22px; display: flex; justify-content: flex-end; gap: 9px; }
.modal-field-row { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }.modal-field-row input, .modal-field-row select { min-height: 40px; font-size: 9.5px; }
.modal-icon--relation { color: var(--purple); background: var(--purple-soft); }.relation-modal { width: min(560px, 100%); }.relation-form-route { margin: 16px 0 12px; display: grid; grid-template-columns: 1fr 25px 1fr; align-items: end; gap: 7px; }.relation-form-route > span { padding-bottom: 11px; color: var(--purple); font-size: 15px; text-align: center; }.relation-form-route select, .relation-type-field select, .relation-modal > .field input { min-height: 40px; font-size: 9px; }.relation-type-field { margin-bottom: 12px; }
.transfer-notice { width: min(470px, calc(100vw - 34px)); min-height: 70px; position: fixed; z-index: 120; right: 22px; bottom: 22px; padding: 13px 13px 13px 15px; display: flex; align-items: center; gap: 11px; border: 1px solid #b9e0d0; border-radius: 12px; background: #fff; color: var(--ok); box-shadow: 0 16px 42px rgba(20,34,56,.18); }.transfer-notice--error { border-color: #f2bcbc; color: var(--err); }.notice-icon { width: 31px; height: 31px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 8px; background: var(--ok-soft); }.transfer-notice--error .notice-icon { background: var(--err-soft); }.notice-icon svg { width: 17px; }.transfer-notice > span:nth-child(2) { min-width: 0; display: flex; flex: 1; flex-direction: column; }.transfer-notice strong { color: var(--text); font-size: 9.5px; }.transfer-notice small { margin-top: 3px; color: var(--muted); font-size: 8px; line-height: 1.4; }.transfer-notice > button { width: 25px; min-height: 25px; padding: 0; border-color: transparent; background: transparent; color: var(--muted); font-size: 16px; }.transfer-notice > button:hover { border-color: transparent; background: var(--surface-soft); color: var(--text); transform: none; }.notice-enter-active, .notice-leave-active { transition: opacity 180ms, transform 180ms; }.notice-enter-from, .notice-leave-to { opacity: 0; transform: translateY(12px); }

@media (max-width: 1280px) {
  .map-layout { grid-template-columns: 1fr; }
  .detail-panel { position: static; }
  .form-grid { grid-template-columns: repeat(3, 1fr); }.field--full { grid-column: auto; }.tool-list { max-height: none; grid-template-columns: repeat(2, 1fr); }
  .process-metrics > div { min-width: 68px; padding: 2px 10px; }
}
@media (max-width: 850px) {
  .process-viewbar { align-items: flex-start; flex-wrap: wrap; }.view-context { order: 3; width: 100%; padding: 0 4px 4px; }
  .process-hero { align-items: flex-start; flex-direction: column; }.process-metrics { width: 100%; }.process-metrics > div { flex: 1; }.process-metrics > div:first-child { border-left: 0; padding-left: 0; }
  .process-tabs { display: none; }.process-select { display: block; }.process-switcher { align-items: flex-start; flex-direction: column; }.switcher-copy { padding: 4px 0; }
  .form-grid { grid-template-columns: 1fr 1fr; }.field--full { grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  .page-actions { width: 100%; flex-direction: column; }.page-actions button { width: 100%; }
  .view-tabs { width: 100%; }.view-tabs button { flex: 1; }.reset-link { width: 100%; margin-left: 0; }.process-viewbar { align-items: stretch; flex-direction: column; }.view-context { order: initial; }
  .process-heading { align-items: flex-start; }.process-symbol { display: none; }.process-name-line { align-items: flex-start; flex-direction: column; }.process-classification { align-items: stretch; flex-direction: column; }.process-classification label { min-width: 0; }.process-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }.process-metrics > div { padding: 0; border-left: 0; }
  .map-legend { display: none; }.form-grid { grid-template-columns: 1fr; }.field--full { grid-column: auto; }.tool-list { grid-template-columns: 1fr; }
  .create-modal { padding: 22px; }.modal-field-row, .relation-form-route { grid-template-columns: 1fr; }.relation-form-route > span { padding: 0; transform: rotate(90deg); }.transfer-notice { right: 12px; bottom: 12px; }
}
.process-viewbar { border-color: var(--border-strong); }
.view-tabs { border: 1px solid var(--border-strong); border-radius: 0; background: transparent; }
.view-tabs button { border-radius: 0; }
.view-tabs button.active { border-color: var(--ink); background: var(--ink); color: var(--acid); box-shadow: none; }
.process-tab, .process-tab--active, .process-tab--active:hover { border-radius: 0; }
.process-tab--active, .process-tab--active:hover { border-color: var(--ink); background: var(--ink); color: var(--paper); }
.process-hero { border: 1px solid var(--ink); border-top: 3px solid var(--acid); border-radius: 0; background: var(--ink); box-shadow: none; }
.process-symbol { border: 1px solid rgba(241,239,232,.35); border-radius: 0; background: transparent; color: var(--acid); }
.process-metrics strong { font-family: 'Space Grotesk', sans-serif; }
.map-insight { border-color: var(--ink); border-radius: 0; background: var(--acid); }
.insight-icon { border: 1px solid var(--ink); border-radius: 0; background: transparent; color: var(--ink); }
.responsibility-row--head { background: var(--surface-soft); }
.tool-option, .edge-route, .logic-hint { border-radius: 0; }
.tool-option--selected { border-color: var(--blue); background: var(--accent-soft); }
.tool-logo, .custom-check, .tool-status { border-radius: 0; }
.create-modal { border: 1px solid var(--ink); border-radius: 0; background: var(--paper); box-shadow: 12px 12px 0 rgba(23,23,20,.14); }
.modal-icon { border: 1px solid currentColor; border-radius: 0; background: transparent; }
.transfer-notice { border-radius: 0; background: var(--paper); box-shadow: 8px 8px 0 rgba(23,23,20,.12); }

/* Stronger information hierarchy and readable controls. */
.process-viewbar { padding: 10px; background: var(--surface-soft); }
.view-tabs { padding: 4px; background: var(--surface); }
.view-tabs button { min-height: 42px; font-size: 11px; }
.view-context { color: #5d5b55; font-size: 10.5px; }
.view-context strong { font-size: 12px; }
.reset-link { font-size: 10.5px; }
.process-switcher { border-color: var(--border-strong); background: var(--surface-muted); }
.switcher-copy span { color: #5d5b55; font-size: 10.5px; }
.switcher-copy strong { font-size: 13px; }
.process-tab { min-height: 47px; font-size: 12px; }
.process-heading p { color: #c3cde0; font-size: 12.5px; }
.process-heading > div > span { color: #c3cde0; font-size: 11px; }
.process-classification label > span { color: #c3cde0; font-size: 9.5px; }
.process-classification input, .process-classification select { min-height: 35px; font-size: 11px; }
.process-metrics span { color: #c3cde0; font-size: 10.5px; }
.map-head, .responsibility-card .section-head, .detail-head { border-bottom-color: var(--border-strong); background: var(--surface-soft); }
.map-head h2, .detail-head h2 { font-size: 18px; }
.map-legend { color: #55544e; font-size: 10.5px; }
.map-insight strong { font-size: 13px; }
.map-insight p { font-size: 11.5px; line-height: 1.55; }
.responsibility-row { min-height: 60px; color: #55544e; font-size: 11px; }
.responsibility-row--head { min-height: 40px; background: #dcd9d0; color: #45443f; font-size: 9.5px; }
.responsibility-row strong { font-size: 12px; }
.autosave { font-size: 10.5px; }
.field > span { color: #55544e; font-size: 11px; }
.field input, .field select, .field textarea { min-height: 40px; font-size: 12px; }
.toggle-field strong { font-size: 11.5px; }
.toggle-field small { font-size: 10px; }
.assignment-head h3 { font-size: 14px; }
.assignment-head span { font-size: 10.5px; }
.tool-option { min-height: 58px; padding: 9px; background: var(--surface-raised); }
.tool-logo { width: 34px; height: 34px; font-size: 9px; }
.tool-info strong { font-size: 11.5px; }
.tool-info small { font-size: 10px; }
.tool-status { font-size: 9px; }
.edge-node small { font-size: 9.5px; }
.edge-node strong { font-size: 11px; }
.logic-hint p { font-size: 10.5px; }
.create-modal > p { font-size: 13px; }
.create-modal > .field input, .modal-field-row input, .modal-field-row select,
.relation-form-route select, .relation-type-field select, .relation-modal > .field input { font-size: 12px; }
.transfer-notice strong { font-size: 12px; }
.transfer-notice small { font-size: 10.5px; }
</style>
