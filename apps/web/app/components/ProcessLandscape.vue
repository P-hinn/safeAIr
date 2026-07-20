<script setup lang="ts">
import { MarkerType, VueFlow, type Edge, type Node, type VueFlowStore } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import type {
  BusinessProcess,
  LandscapeLayer,
  ProcessRelation,
  ProcessRelationType,
  ProcessStatus
} from '~/composables/useProcessMap'
import { calculateProcessMetrics } from '~/composables/useProcessMap'

const props = defineProps<{ processes: BusinessProcess[] }>()
const emit = defineEmits<{
  openProcess: [id: string]
  createRelation: []
  removeRelation: [sourceId: string, relationId: string]
}>()

const search = ref('')
const departmentFilter = ref('all')
const statusFilter = ref<'all' | ProcessStatus>('all')
const relationFilter = ref<'all' | ProcessRelationType>('all')
const layerFilter = ref<'all' | LandscapeLayer>('all')
const showConnections = ref(true)
const densityMode = ref<'overview' | 'detail'>(props.processes.length > 12 ? 'overview' : 'detail')
const layoutRevision = ref(0)
const selectedRelationId = ref('')
const hoveredRelationId = ref('')
const showRelationLabels = ref(false)
const mapCard = ref<HTMLElement>()
const flowStore = shallowRef<VueFlowStore>()
const isFullscreen = ref(false)
let previousBodyOverflow = ''

watch(() => props.processes.length, (count) => {
  densityMode.value = count > 12 ? 'overview' : 'detail'
})

const layerMeta: Array<{ id: LandscapeLayer; name: string; hint: string; number: string }> = [
  { id: 'management', name: 'Steuerungsprozesse', hint: 'Strategie, Governance und Kontrolle', number: '01' },
  { id: 'core', name: 'Kernprozesse', hint: 'Direkte Wertschöpfung und Kundenwirkung', number: '02' },
  { id: 'support', name: 'Unterstützungsprozesse', hint: 'People, Technologie und Enabler', number: '03' }
]

const relationTypes: Array<{ id: ProcessRelationType; label: string; color: string }> = [
  { id: 'handoff', label: 'Übergabe', color: '#246bfd' },
  { id: 'governance', label: 'Governance', color: '#7557d3' },
  { id: 'support', label: 'Unterstützung', color: '#168a5b' },
  { id: 'data', label: 'Datenfluss', color: '#147d96' }
]

const departmentColors = ['#246bfd', '#7557d3', '#168a5b', '#d98212', '#147d96', '#c45473', '#5c718f']
const departments = computed(() => [...new Set(props.processes.map((process) => process.domain))].sort((a, b) => a.localeCompare(b, 'de')))

const visibleProcesses = computed(() => props.processes.filter((process) => {
  const term = search.value.trim().toLowerCase()
  const participants = participatingDepartments(process)
  const matchesSearch = !term || [process.name, process.domain, process.owner, ...participants].some((value) => value.toLowerCase().includes(term))
  const matchesDepartment = departmentFilter.value === 'all' || process.domain === departmentFilter.value || participants.includes(departmentFilter.value)
  const matchesStatus = statusFilter.value === 'all' || process.status === statusFilter.value
  const matchesLayer = layerFilter.value === 'all' || process.landscapeLayer === layerFilter.value
  return matchesSearch && matchesDepartment && matchesStatus && matchesLayer
}))

interface RelationView {
  id: string
  source: BusinessProcess
  target: BusinessProcess
  relation: ProcessRelation
}

const allRelations = computed<RelationView[]>(() => props.processes.flatMap((source) => source.relations.flatMap((relation) => {
  const target = props.processes.find((process) => process.id === relation.targetId)
  return target ? [{ id: `${source.id}::${relation.id}`, source, target, relation }] : []
})))

const visibleRelations = computed(() => {
  if (!showConnections.value) return []
  const processIds = new Set(visibleProcesses.value.map((process) => process.id))
  return allRelations.value.filter((item) => processIds.has(item.source.id)
    && processIds.has(item.target.id)
    && (relationFilter.value === 'all' || item.relation.type === relationFilter.value))
})

const selectedRelation = computed(() => allRelations.value.find((item) => item.id === selectedRelationId.value))
const portfolioMetrics = computed(() => calculateProcessMetrics(props.processes))
const layerCounts = computed(() => Object.fromEntries(layerMeta.map((layer) => [layer.id, props.processes.filter((process) => process.landscapeLayer === layer.id).length])) as Record<LandscapeLayer, number>)

function participatingDepartments(process: BusinessProcess) {
  return [...new Set(process.steps.map((step) => step.department).filter((department) => department && department !== process.domain))]
}

function processMetrics(process: BusinessProcess) { return calculateProcessMetrics([process]) }

function processHighRisks(process: BusinessProcess) {
  return process.steps.filter((step) => step.risk === 'high').length
}

function incomingCount(processId: string) {
  return allRelations.value.filter((item) => item.target.id === processId).length
}

function outgoingCount(processId: string) {
  return allRelations.value.filter((item) => item.source.id === processId).length
}

function departmentColor(department: string) {
  const index = departments.value.indexOf(department)
  return departmentColors[Math.max(0, index) % departmentColors.length] ?? '#246bfd'
}

function initials(value: string) {
  return value.split(/\s|&|\//).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function edgeColor(type: ProcessRelationType) {
  return relationTypes.find((item) => item.id === type)?.color ?? '#246bfd'
}

interface LayoutResult {
  nodes: Node[]
  processPositions: Map<string, { x: number; y: number }>
  width: number
  height: number
}

const layout = computed<LayoutResult>(() => {
  const compact = densityMode.value === 'overview'
  const processWidth = compact ? 206 : 248
  const processHeight = compact ? 82 : 134
  const processGap = compact ? 10 : 18
  const groupGap = compact ? 14 : 28
  const columnsPerGroup = 3
  const groupWidth = (processCount: number) => {
    const columns = Math.min(columnsPerGroup, Math.max(1, processCount))
    return 32 + columns * processWidth + Math.max(0, columns - 1) * processGap
  }
  const groupHeight = (processCount: number) => 52 + Math.ceil(Math.max(1, processCount) / columnsPerGroup) * processHeight + Math.max(0, Math.ceil(processCount / columnsPerGroup) - 1) * processGap
  const groupsByLayer = new Map(layerMeta.map((layer) => {
    const layerProcesses = visibleProcesses.value.filter((process) => process.landscapeLayer === layer.id)
    const groups = [...new Set(layerProcesses.map((process) => process.domain))].sort((a, b) => a.localeCompare(b, 'de')).map((department) => ({
      department,
      processes: layerProcesses.filter((process) => process.domain === department).sort((a, b) => a.name.localeCompare(b.name, 'de'))
    }))
    return [layer.id, groups] as const
  }))
  const bandWidth = compact ? 1420 : 1180
  const bandGap = 18
  const nodes: Node[] = []
  const processPositions = new Map<string, { x: number; y: number }>()
  let bandY = 12

  layerMeta.forEach((layer) => {
    const grouped = groupsByLayer.get(layer.id) ?? []
    let groupX = 58
    let groupY = bandY + 42
    let rowHeight = 0

    grouped.forEach((group) => {
      const width = groupWidth(group.processes.length)
      const height = groupHeight(group.processes.length)
      if (groupX > 58 && groupX + width > bandWidth - 38) {
        groupX = 58
        groupY += rowHeight + groupGap
        rowHeight = 0
      }
      nodes.push({
        id: `department-${layer.id}-${group.department}`,
        type: 'department',
        position: { x: groupX, y: groupY },
        data: {
          name: group.department,
          count: group.processes.length,
          color: departmentColor(group.department),
          initials: initials(group.department)
        },
        selectable: false,
        draggable: false,
        connectable: false,
        zIndex: -1,
        style: { width: `${width}px`, height: `${height}px` }
      })

      group.processes.forEach((process, processIndex) => {
        const column = processIndex % columnsPerGroup
        const row = Math.floor(processIndex / columnsPerGroup)
        const position = { x: groupX + 16 + column * (processWidth + processGap), y: groupY + 38 + row * (processHeight + processGap) }
        const processKpis = processMetrics(process)
        processPositions.set(process.id, position)
        nodes.push({
          id: process.id,
          type: 'landscapeProcess',
          position,
          data: {
            process,
            automationRate: processKpis.automationRate,
            aiShare: processKpis.aiShare,
            highRisks: processHighRisks(process),
            incoming: incomingCount(process.id),
            outgoing: outgoingCount(process.id),
            departments: participatingDepartments(process),
            compact
          },
          draggable: false,
          zIndex: 4
        })
      })
      groupX += width + groupGap
      rowHeight = Math.max(rowHeight, height)
    })
    const bandHeight = Math.max(210, groupY - bandY + rowHeight + 20)
    nodes.push({
      id: `layer-${layer.id}`,
      type: 'landscapeLayer',
      position: { x: 0, y: bandY },
      data: layer,
      selectable: false,
      draggable: false,
      connectable: false,
      zIndex: -3,
      style: { width: `${bandWidth}px`, height: `${bandHeight}px` }
    })
    bandY += bandHeight + bandGap
  })

  return { nodes, processPositions, width: bandWidth, height: bandY + 12 }
})

function handlesFor(source: { x: number; y: number }, target: { x: number; y: number }) {
  const dx = target.x - source.x
  const dy = target.y - source.y
  if (Math.abs(dy) < 50) {
    return { sourceHandle: 'source-bottom', targetHandle: 'target-bottom' }
  }
  if (Math.abs(dy) > Math.abs(dx) * 0.55) {
    return dy > 0
      ? { sourceHandle: 'source-bottom', targetHandle: 'target-top' }
      : { sourceHandle: 'source-top', targetHandle: 'target-bottom' }
  }
  return dx >= 0
    ? { sourceHandle: 'source-right', targetHandle: 'target-left' }
    : { sourceHandle: 'source-left', targetHandle: 'target-right' }
}

const edges = computed<Edge[]>(() => visibleRelations.value.flatMap((item) => {
  const sourcePosition = layout.value.processPositions.get(item.source.id)
  const targetPosition = layout.value.processPositions.get(item.target.id)
  if (!sourcePosition || !targetPosition) return []
  const color = edgeColor(item.relation.type)
  const isSelected = selectedRelationId.value === item.id
  const isHovered = hoveredRelationId.value === item.id
  const hasFocus = Boolean(selectedRelationId.value || hoveredRelationId.value)
  const showLabel = showRelationLabels.value || isSelected || isHovered
  return [{
    id: item.id,
    source: item.source.id,
    target: item.target.id,
    ...handlesFor(sourcePosition, targetPosition),
    type: 'smoothstep',
    label: showLabel ? item.relation.label : undefined,
    selected: isSelected,
    animated: isSelected || isHovered,
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    style: { stroke: color, strokeWidth: isSelected || isHovered ? 3 : 1.8, opacity: hasFocus && !isSelected && !isHovered ? .18 : .88 },
    labelStyle: { fill: color, fontSize: 7.5, fontWeight: 700 },
    labelBgStyle: { fill: '#fff', fillOpacity: .96, stroke: color, strokeWidth: .4 },
    labelBgPadding: [6, 4],
    labelBgBorderRadius: 6,
    pathOptions: Math.abs(sourcePosition.y - targetPosition.y) < 50 ? { offset: 24, borderRadius: 8 } : { offset: 18, borderRadius: 8 },
    zIndex: isSelected || isHovered ? 3 : 2
  }]
}))

const mapKey = computed(() => `${search.value}-${departmentFilter.value}-${statusFilter.value}-${layerFilter.value}-${densityMode.value}-${layoutRevision.value}`)
const relationLabel = (type: ProcessRelationType) => relationTypes.find((item) => item.id === type)?.label ?? type

function handleNodeClick(event: { node: Node }) {
  selectedRelationId.value = ''
  if (event.node.type === 'landscapeProcess') emit('openProcess', event.node.id)
}

function handleEdgeClick(event: { edge: Edge }) {
  selectedRelationId.value = event.edge.id
}

function handleEdgeMouseEnter(event: { edge: Edge }) {
  hoveredRelationId.value = event.edge.id
}

function handleEdgeMouseLeave(event: { edge: Edge }) {
  if (hoveredRelationId.value === event.edge.id) hoveredRelationId.value = ''
}

function handleFlowInit(store: VueFlowStore) {
  flowStore.value = store
  window.setTimeout(refitMap, 320)
}

function refitMap() {
  if (!import.meta.client) return
  window.setTimeout(() => {
    void flowStore.value?.fitView({ padding: isFullscreen.value ? .05 : .07, maxZoom: isFullscreen.value ? 1.14 : 1.04, duration: 260 })
  }, 180)
}

function tidyMap() {
  selectedRelationId.value = ''
  layoutRevision.value += 1
  nextTick(refitMap)
}

function setDensity(mode: 'overview' | 'detail') {
  if (densityMode.value === mode) return
  densityMode.value = mode
  selectedRelationId.value = ''
  nextTick(refitMap)
}

function setFullscreen(active: boolean) {
  if (isFullscreen.value === active) return
  isFullscreen.value = active
  if (active) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = previousBodyOverflow
  }
  nextTick(refitMap)
}

async function toggleFullscreen() {
  if (!import.meta.client || !mapCard.value) return
  if (document.fullscreenElement === mapCard.value) {
    await document.exitFullscreen()
    return
  }
  if (isFullscreen.value) {
    setFullscreen(false)
    return
  }
  try {
    await mapCard.value.requestFullscreen()
  } catch {
    setFullscreen(true)
  }
}

function syncFullscreenState() {
  setFullscreen(document.fullscreenElement === mapCard.value)
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && isFullscreen.value && !document.fullscreenElement) setFullscreen(false)
}

function removeSelectedRelation() {
  if (!selectedRelation.value) return
  emit('removeRelation', selectedRelation.value.source.id, selectedRelation.value.relation.id)
  selectedRelationId.value = ''
}

function minimapColor(node: Node) {
  if (node.type === 'landscapeProcess') {
    const process = (node.data as { process: BusinessProcess }).process
    return process.landscapeLayer === 'management' ? '#7557d3' : process.landscapeLayer === 'core' ? '#246bfd' : '#168a5b'
  }
  return '#e6ebf2'
}

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenState)
  window.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreenState)
  window.removeEventListener('keydown', handleEscape)
  document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <div class="landscape-view">
    <section class="map-kpis" data-process-tour="portfolio-kpis">
      <article><span class="kpi-icon kpi-icon--blue">A</span><div><span>Abteilungen</span><strong>{{ departments.length }}</strong><small>als Bereiche auf der Landkarte</small></div></article>
      <article><span class="kpi-icon kpi-icon--green">P</span><div><span>Prozesse</span><strong>{{ processes.length }}</strong><small>{{ visibleProcesses.length }} aktuell sichtbar</small></div></article>
      <article><span class="kpi-icon kpi-icon--purple">↗</span><div><span>Verbindungen</span><strong>{{ allRelations.length }}</strong><small>mit Richtung und Übergabeobjekt</small></div></article>
      <article><span class="kpi-icon kpi-icon--green">AUT</span><div><span>Automatisierungsgrad</span><strong>{{ portfolioMetrics.automationRate }}%</strong><small>regelbasiert und KI-basiert</small></div></article>
      <article><span class="kpi-icon kpi-icon--amber">KI</span><div><span>KI-Anteil</span><strong>{{ portfolioMetrics.aiShare }}%</strong><small>nur KI-assistiert oder autonom</small></div></article>
    </section>

    <article ref="mapCard" class="card visual-map-card" data-process-tour="landscape-map" :class="{ 'visual-map-card--fullscreen': isFullscreen }">
      <header class="visual-map-head">
        <div>
          <p class="section-kicker">Interaktive Unternehmenskarte</p>
          <h2>Prozesse, Abteilungen und Übergaben</h2>
          <span>Die Flächen sind Abteilungen. Pfeile zeigen, welcher Prozess was an welchen Folgeprozess übergibt.</span>
        </div>
        <div class="map-actions">
          <label class="map-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            <input v-model="search" placeholder="Prozess oder Abteilung …" />
          </label>
          <select v-model="departmentFilter" aria-label="Abteilung filtern">
            <option value="all">Alle Abteilungen</option>
            <option v-for="department in departments" :key="department" :value="department">{{ department }}</option>
          </select>
          <select v-model="statusFilter" aria-label="Status filtern">
            <option value="all">Alle Status</option>
            <option value="active">Produktiv</option>
            <option value="pilot">Pilot</option>
            <option value="planned">Geplant</option>
          </select>
          <select v-model="layerFilter" aria-label="Prozessebene filtern">
            <option value="all">Alle Ebenen · {{ processes.length }}</option>
            <option value="management">Steuerung · {{ layerCounts.management }}</option>
            <option value="core">Kernprozesse · {{ layerCounts.core }}</option>
            <option value="support">Unterstützung · {{ layerCounts.support }}</option>
          </select>
          <div class="density-switch" aria-label="Darstellungsdichte">
            <button :class="{ active: densityMode === 'overview' }" title="Reduzierte Karten für große Portfolios" @click="setDensity('overview')">Übersicht</button>
            <button :class="{ active: densityMode === 'detail' }" title="Alle Prozessdetails direkt auf den Karten" @click="setDensity('detail')">Details</button>
          </div>
          <button class="button-secondary" :aria-pressed="showConnections" @click="showConnections = !showConnections">{{ showConnections ? 'Pfeile aus' : 'Pfeile an' }}</button>
          <button class="button-secondary" title="Landkarte deterministisch anordnen" @click="tidyMap">🧹 Aufräumen</button>
          <button class="button-secondary fullscreen-button" :aria-label="isFullscreen ? 'Vollbild beenden' : 'Landkarte im Vollbild öffnen'" :title="isFullscreen ? 'Vollbild beenden (Esc)' : 'Landkarte im Vollbild öffnen'" @click="toggleFullscreen">
            <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></svg>
            {{ isFullscreen ? 'Beenden' : 'Vollbild' }}
          </button>
          <button @click="emit('createRelation')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Verbindung
          </button>
        </div>
      </header>

      <div class="relation-legend" data-process-tour="relations">
        <span v-if="densityMode === 'overview'" class="overview-note"><b>Übersichtsmodus</b> · {{ visibleProcesses.length }} Prozesse · Details per Klick</span>
        <button :class="{ active: relationFilter === 'all' }" @click="relationFilter = 'all'">Alle Verbindungen <b>{{ allRelations.length }}</b></button>
        <button v-for="type in relationTypes" :key="type.id" :class="{ active: relationFilter === type.id }" :style="{ '--relation-color': type.color }" @click="relationFilter = type.id">
          <i /> {{ type.label }} <b>{{ allRelations.filter((item) => item.relation.type === type.id).length }}</b>
        </button>
        <button class="label-toggle" :class="{ active: showRelationLabels }" :aria-pressed="showRelationLabels" @click="showRelationLabels = !showRelationLabels">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h10M4 18h7"/></svg>
          Pfeiltexte
        </button>
        <span>Pfeil wählen für Details · freie Fläche ziehen · scrollen zum Zoomen</span>
      </div>

      <div class="map-shell" :class="{ 'map-shell--detail': selectedRelation, 'map-shell--overview': densityMode === 'overview' && visibleProcesses.length > 12 }">
        <ClientOnly>
          <VueFlow
            :key="mapKey"
            :nodes="layout.nodes"
            :edges="edges"
            :nodes-draggable="false"
            :nodes-connectable="false"
            :min-zoom="0.25"
            :max-zoom="1.6"
            :fit-view-on-init="true"
            :fit-view-on-init-options="{ padding: 0.06, maxZoom: 1 }"
            :elevate-edges-on-select="true"
            class="landscape-flow"
            @init="handleFlowInit"
            @node-click="handleNodeClick"
            @edge-click="handleEdgeClick"
            @edge-mouse-enter="handleEdgeMouseEnter"
            @edge-mouse-leave="handleEdgeMouseLeave"
            @pane-click="selectedRelationId = ''"
          >
            <template #node-landscapeLayer="nodeProps"><LandscapeLayerNode v-bind="nodeProps" /></template>
            <template #node-department="nodeProps"><DepartmentMapNode v-bind="nodeProps" /></template>
            <template #node-landscapeProcess="nodeProps"><LandscapeProcessNode v-bind="nodeProps" /></template>
            <Background pattern-color="#dfe5ed" :gap="18" :size="1" />
            <MiniMap :node-color="minimapColor" :pannable="true" :zoomable="true" position="bottom-right" />
            <Controls position="bottom-left" />
          </VueFlow>
          <template #fallback><div class="map-loading">Prozesslandkarte wird geladen …</div></template>
        </ClientOnly>

        <div v-if="!visibleProcesses.length" class="map-empty">
          <strong>Keine Prozesse gefunden</strong><span>Filter oder Suchbegriff zurücksetzen.</span>
        </div>

        <aside v-if="selectedRelation" class="relation-detail">
          <header>
            <div><span :style="{ color: edgeColor(selectedRelation.relation.type) }">{{ relationLabel(selectedRelation.relation.type) }}</span><strong>Prozessverbindung</strong></div>
            <button @click="selectedRelationId = ''">×</button>
          </header>
          <button class="detail-process" @click="emit('openProcess', selectedRelation.source.id)"><small>Von · {{ selectedRelation.source.domain }}</small><strong>{{ selectedRelation.source.name }}</strong></button>
          <div class="detail-arrow" :style="{ color: edgeColor(selectedRelation.relation.type) }"><i />↓</div>
          <div class="detail-handoff"><small>Übergabe / Wirkung</small><strong>{{ selectedRelation.relation.label }}</strong></div>
          <div class="detail-arrow" :style="{ color: edgeColor(selectedRelation.relation.type) }"><i />↓</div>
          <button class="detail-process" @click="emit('openProcess', selectedRelation.target.id)"><small>Nach · {{ selectedRelation.target.domain }}</small><strong>{{ selectedRelation.target.name }}</strong></button>
          <button class="delete-relation" @click="removeSelectedRelation">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/></svg>
            Verbindung entfernen
          </button>
        </aside>
      </div>
    </article>
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';
@import '@vue-flow/minimap/dist/style.css';
</style>

<style scoped>
.landscape-view { min-width: 0; display: grid; gap: 20px; container-type: inline-size; }.map-kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; border-top: 1px solid var(--border-strong); border-bottom: 1px solid var(--border-strong); }.map-kpis article { min-height: 96px; padding: 15px 16px; display: flex; align-items: center; gap: 12px; border: 0; border-left: 1px solid var(--border); border-radius: 0; background: transparent; box-shadow: none; }.map-kpis article:first-child { border-left: 0; }.map-kpis article > div { min-width: 0; display: flex; flex-direction: column; }.map-kpis article > div > span { color: var(--muted); font-size: 8px; font-weight: 700; }.map-kpis strong { margin-top: 2px; font-family: 'Space Grotesk', sans-serif; font-size: 23px; }.map-kpis small { margin-top: 2px; color: var(--muted-light); font-size: 7px; }.kpi-icon { width: 37px; height: 37px; flex: 0 0 auto; display: grid; place-items: center; border: 1px solid currentColor; border-radius: 0; background: transparent; font-size: 9px; font-weight: 800; }.kpi-icon--blue { color: var(--accent); background: transparent; }.kpi-icon--green { color: var(--ok); background: transparent; }.kpi-icon--purple { color: var(--purple); background: transparent; }.kpi-icon--amber { color: var(--warn); background: transparent; }
.visual-map-card { min-width: 0; padding: 0; overflow: hidden; container-type: inline-size; }.visual-map-head { min-height: 82px; padding: 14px 17px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--border-strong); }.visual-map-head > div:first-child { min-width: 0; }.section-kicker { margin: 0; color: var(--accent); font-size: 7.5px; font-weight: 800; letter-spacing: .9px; text-transform: uppercase; }.visual-map-head h2 { margin: 3px 0 1px; font-size: 17px; }.visual-map-head > div > span { color: var(--muted); font-size: 7.5px; }.map-actions { min-width: 0; display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 6px; }.map-actions select { width: 110px; min-height: 34px; padding: 0 8px; font-size: 7.3px; }.map-actions select:nth-child(2) { width: 132px; }.map-actions > button { min-height: 34px; padding: 0 10px; font-size: 7.7px; white-space: nowrap; }.map-actions > button svg { width: 13px; }.map-actions .fullscreen-button { border-color: var(--ink); background: transparent; color: var(--text); }.map-actions .fullscreen-button:hover { border-color: var(--ink); background: var(--ink); color: var(--paper); }.map-search { width: 168px; min-width: 0; min-height: 34px; padding: 0 9px; display: flex; align-items: center; gap: 6px; border: 1px solid var(--border-strong); border-radius: 0; }.map-search svg { width: 12px; flex: 0 0 auto; color: var(--muted-light); }.map-search input { width: 100%; min-width: 0; min-height: 29px; padding: 0; border: 0; outline: 0; font-size: 7.3px; }
.density-switch { min-height: 34px; padding: 3px; display: flex; align-items: center; border: 1px solid var(--border-strong); background: var(--surface-raised); }.density-switch button { min-height: 32px; padding: 0 9px; border: 0; background: transparent; color: var(--muted); font-size: 7.7px; }.density-switch button:hover { border: 0; background: var(--surface-muted); color: var(--text); transform: none; }.density-switch button.active { background: var(--ink); color: var(--acid); }
.relation-legend { min-height: 42px; padding: 6px 12px; display: flex; align-items: center; gap: 4px; border-bottom: 1px solid var(--border); background: #ebe8df; overflow-x: auto; }.relation-legend button { min-height: 27px; padding: 0 8px; flex: 0 0 auto; border-radius: 0; border-color: transparent; background: transparent; color: var(--muted); font-size: 6.7px; }.relation-legend button:hover { border-color: transparent; background: var(--paper); color: var(--text); transform: none; }.relation-legend button.active { border-color: var(--ink); background: var(--ink); color: var(--paper); box-shadow: none; }.relation-legend button i { width: 13px; height: 2px; display: inline-block; background: var(--relation-color, #64748b); vertical-align: middle; }.relation-legend button b { margin-left: 3px; }.relation-legend .label-toggle { margin-left: 4px; border-left: 1px solid var(--border); border-radius: 0; }.relation-legend .label-toggle svg { width: 11px; }.relation-legend > span { margin-left: auto; flex: 0 0 auto; color: var(--muted-light); font-size: 6.3px; }.relation-legend .overview-note { margin: 0 8px 0 0; padding-right: 12px; border-right: 1px solid var(--border-strong); color: var(--text); }.overview-note b { color: #354dcc; }
.map-shell { height: 700px; position: relative; display: grid; grid-template-columns: minmax(0, 1fr); background: #f1efe8; transition: 180ms; }.map-shell--overview { height: 960px; }.landscape-flow { min-width: 0; width: 100%; height: 100%; }.landscape-flow :deep(.vue-flow__node) { width: auto; padding: 0; border: 0; background: transparent; box-shadow: none; }.landscape-flow :deep(.vue-flow__node.selected) { box-shadow: none; }.landscape-flow :deep(.vue-flow__edge-path) { filter: none; transition: opacity 140ms, stroke-width 140ms; }.landscape-flow :deep(.vue-flow__edge.selected .vue-flow__edge-path) { filter: drop-shadow(0 2px 3px rgba(92,118,255,.24)); }.landscape-flow :deep(.vue-flow__edge-label) { font-family: 'DM Sans', sans-serif; }.landscape-flow :deep(.vue-flow__controls) { overflow: hidden; border: 1px solid var(--ink); border-radius: 0; box-shadow: none; }.landscape-flow :deep(.vue-flow__controls-button) { width: 28px; height: 28px; border-color: var(--border); background: var(--paper); color: var(--text); }.landscape-flow :deep(.vue-flow__minimap) { width: 118px; height: 76px; overflow: hidden; border: 1px solid var(--ink); border-radius: 0; background: rgba(241,239,232,.94); box-shadow: none; }.map-loading, .map-empty { position: absolute; inset: 0; display: grid; place-content: center; background: #f1efe8; color: var(--muted); text-align: center; }.map-empty { z-index: 10; }.map-empty strong { font-size: 11px; }.map-empty span { margin-top: 4px; font-size: 8px; }
.relation-detail { width: 276px; padding: 16px; position: absolute; z-index: 8; top: 12px; right: 12px; bottom: 12px; overflow-y: auto; border: 1px solid var(--border); border-radius: 12px; background: rgba(255,255,255,.97); box-shadow: 0 16px 40px rgba(20,34,56,.16); backdrop-filter: blur(8px); }.relation-detail > header { display: flex; justify-content: space-between; }.relation-detail > header > div { display: flex; flex-direction: column; }.relation-detail > header span { font-size: 7px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; }.relation-detail > header strong { margin-top: 3px; font-size: 13px; }.relation-detail > header button { width: 27px; min-height: 27px; padding: 0; border-color: transparent; background: transparent; color: var(--muted); font-size: 17px; }.detail-process { width: 100%; min-height: 65px; margin-top: 18px; padding: 11px; align-items: flex-start; flex-direction: column; border-color: var(--border); background: #f9fbfd; color: var(--text); text-align: left; }.detail-process:hover { border-color: #afc0d8; background: #fff; color: var(--text); transform: none; }.detail-process small { color: var(--accent); font-size: 6px; font-weight: 800; text-transform: uppercase; }.detail-process strong { margin-top: 4px; font-size: 9px; }.detail-arrow { height: 32px; display: flex; align-items: center; justify-content: center; flex-direction: column; font-size: 10px; }.detail-arrow i { width: 1px; height: 13px; background: currentColor; }.detail-handoff { padding: 11px; border: 1px solid #dce4ef; border-radius: 8px; background: #fff; text-align: center; }.detail-handoff small { display: block; color: var(--muted-light); font-size: 6px; font-weight: 700; text-transform: uppercase; }.detail-handoff strong { margin-top: 4px; display: block; font-size: 8px; line-height: 1.4; }.delete-relation { width: 100%; margin-top: 20px; border-color: #f0c9c9; background: var(--err-soft); color: var(--err); }.delete-relation:hover { border-color: #e8aaaa; background: #ffe8e8; color: var(--err); }.delete-relation svg { width: 13px; }
.visual-map-card--fullscreen { width: 100vw; height: 100vh; position: fixed; z-index: 1000; inset: 0; display: grid; grid-template-rows: auto auto minmax(0, 1fr); border: 0; border-radius: 0; background: #fff; box-shadow: none; }.visual-map-card--fullscreen .visual-map-head { min-height: 70px; padding: 11px 16px; }.visual-map-card--fullscreen .map-shell { height: auto; min-height: 0; }.visual-map-card:fullscreen { width: 100vw; height: 100vh; display: grid; grid-template-rows: auto auto minmax(0, 1fr); border: 0; border-radius: 0; background: #fff; }.visual-map-card:fullscreen .map-shell { height: auto; min-height: 0; }
@media (max-width: 1180px) { .map-kpis { grid-template-columns: 1fr 1fr; }.visual-map-head { align-items: flex-start; flex-direction: column; }.map-actions { width: 100%; flex-wrap: wrap; }.map-search { flex: 1; }.map-shell { height: 680px; }.visual-map-card--fullscreen .visual-map-head, .visual-map-card:fullscreen .visual-map-head { align-items: center; flex-direction: row; }.visual-map-card--fullscreen .map-actions, .visual-map-card:fullscreen .map-actions { width: auto; } }
@media (max-width: 760px) { .map-kpis { grid-template-columns: 1fr; }.map-kpis article { min-height: 75px; }.map-actions { flex-direction: column; }.map-search, .map-actions select, .map-actions select:nth-child(2), .map-actions > button { width: 100%; }.relation-legend > span { display: none; }.map-shell { height: 700px; }.map-shell--overview { height: 840px; }.relation-detail { width: calc(100% - 20px); height: auto; max-height: 62%; top: auto; right: 10px; bottom: 10px; left: 10px; }.detail-process { margin-top: 12px; }.detail-arrow { height: 22px; }.detail-arrow i { height: 9px; }.visual-map-card--fullscreen .visual-map-head, .visual-map-card:fullscreen .visual-map-head { max-height: 42vh; align-items: flex-start; flex-direction: column; overflow-y: auto; }.visual-map-card--fullscreen .map-actions, .visual-map-card:fullscreen .map-actions { width: 100%; flex-direction: row; }.visual-map-card--fullscreen .map-search, .visual-map-card:fullscreen .map-search { width: 100%; flex-basis: 100%; }.visual-map-card--fullscreen .map-actions select, .visual-map-card--fullscreen .map-actions > button, .visual-map-card:fullscreen .map-actions select, .visual-map-card:fullscreen .map-actions > button { width: auto; flex: 1; } }
.relation-detail { border-color: var(--ink); border-radius: 0; background: rgba(248,246,239,.97); box-shadow: 8px 8px 0 rgba(23,23,20,.1); }
.visual-map-card--fullscreen, .visual-map-card:fullscreen { background: var(--paper); }

/* The portfolio summary and map tools form separate, readable planes. */
.map-kpis { border: 1px solid var(--border-strong); background: var(--surface); }
.map-kpis article { min-height: 112px; padding: 18px; border-left-color: var(--border-strong); background: var(--surface); }
.map-kpis article:nth-child(even) { background: var(--surface-muted); }
.map-kpis article > div > span { color: #4f4e48; font-size: 11.5px; }
.map-kpis small { color: var(--muted); font-size: 10px; }
.kpi-icon { width: 42px; height: 42px; font-size: 11px; }
.visual-map-head { min-height: 96px; padding: 18px 20px; background: var(--surface-soft); }
.section-kicker { color: #354dcc; font-size: 10.5px; }
.visual-map-head h2 { font-size: 20px; }
.visual-map-head > div > span { color: #575750; font-size: 11px; }
.map-actions select { min-height: 40px; padding-inline: 10px; font-size: 10.5px; background: var(--surface-raised); }
.map-actions > button { min-height: 40px; font-size: 10.5px; }
.map-search { min-height: 40px; background: var(--surface-raised); }
.map-search input { min-height: 34px; font-size: 10.5px; background: transparent; }
.density-switch { min-height: 40px; }
.density-switch button { min-height: 34px; font-size: 10px; }
.relation-legend { min-height: 50px; padding-inline: 16px; border-bottom-color: var(--border-strong); background: #dcd9d0; }
.relation-legend button { min-height: 32px; font-size: 9.5px; }
.relation-legend > span { color: #55544e; font-size: 9px; }
.map-shell, .map-loading, .map-empty { background: var(--surface-muted); }
.map-empty strong { font-size: 14px; }
.map-empty span { font-size: 11px; }
.relation-detail > header span { font-size: 10px; }
.relation-detail > header strong { font-size: 15px; }
.detail-process small, .detail-handoff small { font-size: 9px; }
.detail-process strong { font-size: 12px; }
.detail-handoff strong { font-size: 11px; }

@container (max-width: 1250px) {
  .visual-map-head { align-items: stretch; flex-direction: column; gap: 15px; }
  .visual-map-head > div:first-child { max-width: 720px; }
  .map-actions { width: 100%; display: grid; grid-template-columns: minmax(190px, 1.6fr) repeat(3, minmax(120px, 1fr)); }
  .map-search, .map-actions select, .map-actions select:nth-child(2), .map-actions > button, .density-switch { width: 100%; }
}

@container (max-width: 1000px) {
  .map-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .map-kpis article:nth-child(odd) { border-left: 0; }
  .relation-legend > span { display: none; }
}

@container (max-width: 760px) {
  .map-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .map-search { grid-column: 1 / -1; }
}

@container (max-width: 520px) {
  .map-kpis, .map-actions { grid-template-columns: 1fr; }
  .map-search { grid-column: auto; }
  .map-kpis article { border-left: 0; }
  .density-switch button { flex: 1; }
}
</style>
