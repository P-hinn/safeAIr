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
const selectedRelationId = ref('')
const hoveredRelationId = ref('')
const showRelationLabels = ref(false)
const mapCard = ref<HTMLElement>()
const flowStore = shallowRef<VueFlowStore>()
const isFullscreen = ref(false)
let previousBodyOverflow = ''

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
  return matchesSearch && matchesDepartment && matchesStatus
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
  const processIds = new Set(visibleProcesses.value.map((process) => process.id))
  return allRelations.value.filter((item) => processIds.has(item.source.id)
    && processIds.has(item.target.id)
    && (relationFilter.value === 'all' || item.relation.type === relationFilter.value))
})

const selectedRelation = computed(() => allRelations.value.find((item) => item.id === selectedRelationId.value))
const coverage = computed(() => {
  const steps = props.processes.flatMap((process) => process.steps)
  return steps.length ? Math.round(steps.filter((step) => step.toolIds.length).length / steps.length * 100) : 0
})

function participatingDepartments(process: BusinessProcess) {
  return [...new Set(process.steps.map((step) => step.department).filter((department) => department && department !== process.domain))]
}

function processCoverage(process: BusinessProcess) {
  return process.steps.length ? Math.round(process.steps.filter((step) => step.toolIds.length).length / process.steps.length * 100) : 0
}

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
  const processWidth = 238
  const processGap = 18
  const groupGap = 34
  const groupWidth = (processCount: number) => Math.max(278, 40 + processCount * processWidth + Math.max(0, processCount - 1) * processGap + 40)
  const groupsByLayer = new Map(layerMeta.map((layer) => {
    const layerProcesses = visibleProcesses.value.filter((process) => process.landscapeLayer === layer.id)
    const groups = [...new Set(layerProcesses.map((process) => process.domain))].map((department) => ({
      department,
      processes: layerProcesses.filter((process) => process.domain === department)
    }))
    return [layer.id, groups] as const
  }))
  const requiredWidth = Math.max(...layerMeta.map((layer) => {
    const groups = groupsByLayer.get(layer.id) ?? []
    return groups.reduce((sum, group) => sum + groupWidth(group.processes.length), 0) + Math.max(0, groups.length - 1) * groupGap + 116
  }))
  const bandWidth = Math.max(1040, requiredWidth)
  const bandHeight = 218
  const bandGap = 18
  const nodes: Node[] = []
  const processPositions = new Map<string, { x: number; y: number }>()

  layerMeta.forEach((layer, layerIndex) => {
    const bandY = 12 + layerIndex * (bandHeight + bandGap)
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

    const grouped = groupsByLayer.get(layer.id) ?? []
    const groupWidths = grouped.map((group) => groupWidth(group.processes.length))
    const totalWidth = groupWidths.reduce((sum, width) => sum + width, 0) + Math.max(0, grouped.length - 1) * groupGap
    let groupX = Math.max(58, (bandWidth - totalWidth) / 2)

    grouped.forEach((group, groupIndex) => {
      const width = groupWidths[groupIndex] ?? 278
      const groupY = bandY + 42
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
        style: { width: `${width}px`, height: '160px' }
      })

      group.processes.forEach((process, processIndex) => {
        const position = { x: groupX + 20 + processIndex * (processWidth + processGap), y: groupY + 39 }
        processPositions.set(process.id, position)
        nodes.push({
          id: process.id,
          type: 'landscapeProcess',
          position,
          data: {
            process,
            coverage: processCoverage(process),
            highRisks: processHighRisks(process),
            incoming: incomingCount(process.id),
            outgoing: outgoingCount(process.id),
            departments: participatingDepartments(process)
          },
          draggable: false,
          zIndex: 4
        })
      })
      groupX += width + groupGap
    })
  })

  return { nodes, processPositions, width: bandWidth, height: 24 + 3 * bandHeight + 2 * bandGap }
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

const mapKey = computed(() => `${search.value}-${departmentFilter.value}-${statusFilter.value}`)
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
}

function refitMap() {
  if (!import.meta.client) return
  window.setTimeout(() => {
    void flowStore.value?.fitView({ padding: isFullscreen.value ? .05 : .07, maxZoom: isFullscreen.value ? 1.14 : 1.04, duration: 260 })
  }, 180)
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
    <section class="map-kpis">
      <article><span class="kpi-icon kpi-icon--blue">A</span><div><span>Abteilungen</span><strong>{{ departments.length }}</strong><small>als Bereiche auf der Landkarte</small></div></article>
      <article><span class="kpi-icon kpi-icon--green">P</span><div><span>Prozesse</span><strong>{{ processes.length }}</strong><small>{{ visibleProcesses.length }} aktuell sichtbar</small></div></article>
      <article><span class="kpi-icon kpi-icon--purple">↗</span><div><span>Verbindungen</span><strong>{{ allRelations.length }}</strong><small>mit Richtung und Übergabeobjekt</small></div></article>
      <article><span class="kpi-icon kpi-icon--amber">AI</span><div><span>AI Coverage</span><strong>{{ coverage }}%</strong><small>über das gesamte Portfolio</small></div></article>
    </section>

    <article ref="mapCard" class="card visual-map-card" :class="{ 'visual-map-card--fullscreen': isFullscreen }">
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

      <div class="relation-legend">
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

      <div class="map-shell" :class="{ 'map-shell--detail': selectedRelation }">
        <ClientOnly>
          <VueFlow
            :key="mapKey"
            :nodes="layout.nodes"
            :edges="edges"
            :nodes-draggable="false"
            :nodes-connectable="false"
            :min-zoom="0.45"
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

<style scoped>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';
@import '@vue-flow/minimap/dist/style.css';

.landscape-view { display: grid; gap: 20px; }.map-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }.map-kpis article { min-height: 92px; padding: 15px 16px; display: flex; align-items: center; gap: 12px; border: 1px solid var(--border); border-radius: 12px; background: #fff; box-shadow: var(--shadow-sm); }.map-kpis article > div { min-width: 0; display: flex; flex-direction: column; }.map-kpis article > div > span { color: var(--muted); font-size: 8px; font-weight: 700; }.map-kpis strong { margin-top: 2px; font-family: 'Manrope', sans-serif; font-size: 21px; }.map-kpis small { margin-top: 2px; color: var(--muted-light); font-size: 7px; }.kpi-icon { width: 37px; height: 37px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 10px; font-size: 9px; font-weight: 800; }.kpi-icon--blue { color: var(--accent); background: var(--accent-soft); }.kpi-icon--green { color: var(--ok); background: var(--ok-soft); }.kpi-icon--purple { color: var(--purple); background: var(--purple-soft); }.kpi-icon--amber { color: var(--warn); background: var(--warn-soft); }
.visual-map-card { padding: 0; overflow: hidden; }.visual-map-head { min-height: 78px; padding: 14px 17px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--border); }.section-kicker { margin: 0; color: var(--accent); font-size: 7.5px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; }.visual-map-head h2 { margin: 3px 0 1px; font-size: 15px; }.visual-map-head > div > span { color: var(--muted); font-size: 7.5px; }.map-actions { display: flex; gap: 6px; }.map-actions select { width: 110px; min-height: 34px; padding: 0 8px; font-size: 7.3px; }.map-actions select:nth-child(2) { width: 132px; }.map-actions > button { min-height: 34px; padding: 0 10px; font-size: 7.7px; }.map-actions > button svg { width: 13px; }.map-actions .fullscreen-button { border-color: #d5deeb; background: #fff; color: var(--text); }.map-actions .fullscreen-button:hover { border-color: #b9c9df; background: #f7f9fc; color: var(--text); }.map-search { width: 168px; min-height: 34px; padding: 0 9px; display: flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 8px; }.map-search svg { width: 12px; color: var(--muted-light); }.map-search input { width: 100%; min-height: 29px; padding: 0; border: 0; outline: 0; font-size: 7.3px; }
.relation-legend { min-height: 40px; padding: 6px 12px; display: flex; align-items: center; gap: 4px; border-bottom: 1px solid var(--border); background: #fafbfd; overflow-x: auto; }.relation-legend button { min-height: 27px; padding: 0 8px; flex: 0 0 auto; border-color: transparent; background: transparent; color: var(--muted); font-size: 6.7px; }.relation-legend button:hover { border-color: transparent; background: #fff; color: var(--text); transform: none; }.relation-legend button.active { border-color: #d7e1f3; background: #fff; color: var(--text); box-shadow: 0 2px 6px rgba(20,34,56,.05); }.relation-legend button i { width: 13px; height: 2px; display: inline-block; background: var(--relation-color, #64748b); vertical-align: middle; }.relation-legend button b { margin-left: 3px; }.relation-legend .label-toggle { margin-left: 4px; border-left: 1px solid var(--border); border-radius: 0 7px 7px 0; }.relation-legend .label-toggle svg { width: 11px; }.relation-legend > span { margin-left: auto; flex: 0 0 auto; color: var(--muted-light); font-size: 6.3px; }
.map-shell { height: 700px; position: relative; display: grid; grid-template-columns: minmax(0, 1fr); background: #f8fafc; transition: 180ms; }.landscape-flow { min-width: 0; width: 100%; height: 100%; }.landscape-flow :deep(.vue-flow__node) { width: auto; padding: 0; border: 0; background: transparent; box-shadow: none; }.landscape-flow :deep(.vue-flow__node.selected) { box-shadow: none; }.landscape-flow :deep(.vue-flow__edge-path) { filter: drop-shadow(0 1px 1px rgba(20,34,56,.1)); transition: opacity 140ms, stroke-width 140ms; }.landscape-flow :deep(.vue-flow__edge.selected .vue-flow__edge-path) { filter: drop-shadow(0 2px 3px rgba(36,107,253,.25)); }.landscape-flow :deep(.vue-flow__edge-label) { font-family: 'DM Sans', sans-serif; }.landscape-flow :deep(.vue-flow__controls) { overflow: hidden; border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow-sm); }.landscape-flow :deep(.vue-flow__controls-button) { width: 28px; height: 28px; border-color: var(--border); background: #fff; color: var(--text); }.landscape-flow :deep(.vue-flow__minimap) { width: 118px; height: 76px; overflow: hidden; border: 1px solid var(--border); border-radius: 9px; background: rgba(255,255,255,.92); box-shadow: var(--shadow-sm); }.map-loading, .map-empty { position: absolute; inset: 0; display: grid; place-content: center; background: #f8fafc; color: var(--muted); text-align: center; }.map-empty { z-index: 10; }.map-empty strong { font-size: 11px; }.map-empty span { margin-top: 4px; font-size: 8px; }
.relation-detail { width: 276px; padding: 16px; position: absolute; z-index: 8; top: 12px; right: 12px; bottom: 12px; overflow-y: auto; border: 1px solid var(--border); border-radius: 12px; background: rgba(255,255,255,.97); box-shadow: 0 16px 40px rgba(20,34,56,.16); backdrop-filter: blur(8px); }.relation-detail > header { display: flex; justify-content: space-between; }.relation-detail > header > div { display: flex; flex-direction: column; }.relation-detail > header span { font-size: 7px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; }.relation-detail > header strong { margin-top: 3px; font-size: 13px; }.relation-detail > header button { width: 27px; min-height: 27px; padding: 0; border-color: transparent; background: transparent; color: var(--muted); font-size: 17px; }.detail-process { width: 100%; min-height: 65px; margin-top: 18px; padding: 11px; align-items: flex-start; flex-direction: column; border-color: var(--border); background: #f9fbfd; color: var(--text); text-align: left; }.detail-process:hover { border-color: #afc0d8; background: #fff; color: var(--text); transform: none; }.detail-process small { color: var(--accent); font-size: 6px; font-weight: 800; text-transform: uppercase; }.detail-process strong { margin-top: 4px; font-size: 9px; }.detail-arrow { height: 32px; display: flex; align-items: center; justify-content: center; flex-direction: column; font-size: 10px; }.detail-arrow i { width: 1px; height: 13px; background: currentColor; }.detail-handoff { padding: 11px; border: 1px solid #dce4ef; border-radius: 8px; background: #fff; text-align: center; }.detail-handoff small { display: block; color: var(--muted-light); font-size: 6px; font-weight: 700; text-transform: uppercase; }.detail-handoff strong { margin-top: 4px; display: block; font-size: 8px; line-height: 1.4; }.delete-relation { width: 100%; margin-top: 20px; border-color: #f0c9c9; background: var(--err-soft); color: var(--err); }.delete-relation:hover { border-color: #e8aaaa; background: #ffe8e8; color: var(--err); }.delete-relation svg { width: 13px; }
.visual-map-card--fullscreen { width: 100vw; height: 100vh; position: fixed; z-index: 1000; inset: 0; display: grid; grid-template-rows: auto auto minmax(0, 1fr); border: 0; border-radius: 0; background: #fff; box-shadow: none; }.visual-map-card--fullscreen .visual-map-head { min-height: 70px; padding: 11px 16px; }.visual-map-card--fullscreen .map-shell { height: auto; min-height: 0; }.visual-map-card:fullscreen { width: 100vw; height: 100vh; display: grid; grid-template-rows: auto auto minmax(0, 1fr); border: 0; border-radius: 0; background: #fff; }.visual-map-card:fullscreen .map-shell { height: auto; min-height: 0; }
@media (max-width: 1180px) { .map-kpis { grid-template-columns: 1fr 1fr; }.visual-map-head { align-items: flex-start; flex-direction: column; }.map-actions { width: 100%; flex-wrap: wrap; }.map-search { flex: 1; }.map-shell { height: 680px; }.visual-map-card--fullscreen .visual-map-head, .visual-map-card:fullscreen .visual-map-head { align-items: center; flex-direction: row; }.visual-map-card--fullscreen .map-actions, .visual-map-card:fullscreen .map-actions { width: auto; } }
@media (max-width: 760px) { .map-kpis { grid-template-columns: 1fr; }.map-kpis article { min-height: 75px; }.map-actions { flex-direction: column; }.map-search, .map-actions select, .map-actions select:nth-child(2), .map-actions > button { width: 100%; }.relation-legend > span { display: none; }.map-shell { height: 700px; }.relation-detail { width: calc(100% - 20px); height: auto; max-height: 62%; top: auto; right: 10px; bottom: 10px; left: 10px; }.detail-process { margin-top: 12px; }.detail-arrow { height: 22px; }.detail-arrow i { height: 9px; }.visual-map-card--fullscreen .visual-map-head, .visual-map-card:fullscreen .visual-map-head { max-height: 42vh; align-items: flex-start; flex-direction: column; overflow-y: auto; }.visual-map-card--fullscreen .map-actions, .visual-map-card:fullscreen .map-actions { width: 100%; flex-direction: row; }.visual-map-card--fullscreen .map-search, .visual-map-card:fullscreen .map-search { width: 100%; flex-basis: 100%; }.visual-map-card--fullscreen .map-actions select, .visual-map-card--fullscreen .map-actions > button, .visual-map-card:fullscreen .map-actions select, .visual-map-card:fullscreen .map-actions > button { width: auto; flex: 1; } }
</style>
