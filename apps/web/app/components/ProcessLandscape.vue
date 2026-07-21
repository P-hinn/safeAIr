<script setup lang="ts">
import { MarkerType, VueFlow, type Edge, type Node, type VueFlowStore } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import type {
  AiTool,
  BusinessProcess,
  DataFlow,
  DataFlowGapType,
  LandscapeLayer,
  ProcessRelation,
  ProcessRelationType,
  ProcessStatus
} from '~/composables/useProcessMap'
import { analyzeDataFlowGaps, calculateProcessMetrics, dataFlowIssues } from '~/composables/useProcessMap'

const props = defineProps<{ processes: BusinessProcess[]; dataFlows: DataFlow[]; tools: AiTool[] }>()
const emit = defineEmits<{
  openProcess: [id: string]
  createRelation: []
  removeRelation: [sourceId: string, relationId: string]
  updateDataFlow: [id: string, patch: Partial<DataFlow>]
  removeDataFlow: [id: string]
}>()

const search = ref('')
const departmentFilter = ref('all')
const statusFilter = ref<'all' | ProcessStatus>('all')
const relationFilter = ref<'all' | ProcessRelationType>('all')
const layerFilter = ref<'all' | LandscapeLayer>('all')
const flowQuestionFilter = ref<'all' | 'external' | 'personal' | 'open' | 'ai' | 'owner_missing'>('all')
const gapTypeFilter = ref<'all' | DataFlowGapType>('all')
const showConnections = ref(true)
const densityMode = ref<'overview' | 'detail'>(props.processes.length > 12 ? 'overview' : 'detail')
const layoutRevision = ref(0)
const selectedRelationId = ref('')
const hoveredRelationId = ref('')
const showRelationLabels = ref(false)
const showPortfolioKpis = ref(false)
const viewportZoom = ref(1)
const mapCard = ref<HTMLElement>()
const flowStore = shallowRef<VueFlowStore>()
const isFullscreen = ref(false)
let previousBodyOverflow = ''

const KPI_VISIBILITY_STORAGE_KEY = 'safair:process-map-kpis'
const DOMAIN_ZOOM_THRESHOLD = 0.58

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

function relatedDataFlows(processId: string) {
  return props.dataFlows.filter((flow) => flow.sourceProcessId === processId || flow.targetProcessId === processId)
}

function matchesFlowQuestion(flow: DataFlow) {
  if (flowQuestionFilter.value === 'external') return flow.isExternal
  if (flowQuestionFilter.value === 'personal') return flow.sensitivity === 'personal'
  if (flowQuestionFilter.value === 'open') return flow.controlStatus === 'review_required' || dataFlowIssues(flow).length > 0
  if (flowQuestionFilter.value === 'ai') return Boolean(flow.aiToolId)
  if (flowQuestionFilter.value === 'owner_missing') return !flow.owner.trim()
  return true
}

const visibleProcesses = computed(() => props.processes.filter((process) => {
  const term = search.value.trim().toLowerCase()
  const participants = participatingDepartments(process)
  const matchesSearch = !term || [process.name, process.domain, process.owner, ...participants].some((value) => value.toLowerCase().includes(term))
  const matchesDepartment = departmentFilter.value === 'all' || process.domain === departmentFilter.value || participants.includes(departmentFilter.value)
  const matchesStatus = statusFilter.value === 'all' || process.status === statusFilter.value
  const matchesLayer = layerFilter.value === 'all' || process.landscapeLayer === layerFilter.value
  const matchesGovernanceQuestion = flowQuestionFilter.value === 'all' || relatedDataFlows(process.id).some(matchesFlowQuestion)
  return matchesSearch && matchesDepartment && matchesStatus && matchesLayer && matchesGovernanceQuestion
}))

interface RelationView {
  id: string
  source: BusinessProcess
  target: BusinessProcess
  relation: ProcessRelation
}

const allRelations = computed<RelationView[]>(() => props.processes.flatMap((source) => source.relations.flatMap((relation) => {
  if (relation.type === 'data') return []
  const target = props.processes.find((process) => process.id === relation.targetId)
  return target ? [{ id: `${source.id}::${relation.id}`, source, target, relation }] : []
})))

interface DataFlowView {
  id: string
  source: BusinessProcess
  target?: BusinessProcess
  flow: DataFlow
}

const allDataFlows = computed<DataFlowView[]>(() => props.dataFlows.flatMap((flow) => {
  const source = props.processes.find((process) => process.id === flow.sourceProcessId)
  if (!source) return []
  return [{ id: `flow::${flow.id}`, source, target: props.processes.find((process) => process.id === flow.targetProcessId), flow }]
}))

const visibleRelations = computed(() => {
  if (!showConnections.value) return []
  const processIds = new Set(visibleProcesses.value.map((process) => process.id))
  return allRelations.value.filter((item) => processIds.has(item.source.id)
    && processIds.has(item.target.id)
    && (relationFilter.value === 'all' || item.relation.type === relationFilter.value))
})

const visibleDataFlows = computed(() => {
  if (!showConnections.value) return []
  const processIds = new Set(visibleProcesses.value.map((process) => process.id))
  return allDataFlows.value.filter((item) => processIds.has(item.source.id)
    && (!item.target || processIds.has(item.target.id))
    && matchesFlowQuestion(item.flow)
    && (relationFilter.value === 'all' || relationFilter.value === 'data'))
})

const selectedRelation = computed(() => allRelations.value.find((item) => item.id === selectedRelationId.value))
const selectedDataFlow = computed(() => allDataFlows.value.find((item) => item.id === selectedRelationId.value))
const portfolioGaps = computed(() => analyzeDataFlowGaps(props.processes, props.dataFlows))
const visiblePortfolioGaps = computed(() => gapTypeFilter.value === 'all' ? portfolioGaps.value : portfolioGaps.value.filter((gap) => gap.type === gapTypeFilter.value))
const isDomainZoom = computed(() => visibleProcesses.value.length > 6 && viewportZoom.value < DOMAIN_ZOOM_THRESHOLD)
const semanticLabelScale = computed(() => Math.min(2.4, Math.max(1, 1 / Math.max(viewportZoom.value, .25))).toFixed(2))
const layerCounts = computed(() => Object.fromEntries(layerMeta.map((layer) => [layer.id, props.processes.filter((process) => process.landscapeLayer === layer.id).length])) as Record<LandscapeLayer, number>)

function participatingDepartments(process: BusinessProcess) {
  return [...new Set(process.steps.map((step) => step.department).filter((department) => department && department !== process.domain))]
}

function processMetrics(process: BusinessProcess) { return calculateProcessMetrics([process]) }

function dataFlowStats(processId: string) {
  const flows = relatedDataFlows(processId)
  return {
    total: flows.length,
    external: flows.filter((flow) => flow.isExternal).length,
    open: flows.filter((flow) => flow.controlStatus === 'review_required' || dataFlowIssues(flow).length).length
  }
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

const sensitivityColors: Record<DataFlow['sensitivity'], string> = {
  unclassified: '#77756f',
  public: '#168a5b',
  internal: '#246bfd',
  confidential: '#d98212',
  personal: '#c23b54'
}
const sensitivityLabel = (value: DataFlow['sensitivity']) => value === 'public' ? 'Öffentlich' : value === 'internal' ? 'Intern' : value === 'confidential' ? 'Vertraulich' : value === 'personal' ? 'Personenbezogen' : 'Nicht klassifiziert'
const directionLabel = (value: DataFlow['direction']) => value === 'inbound' ? 'Eingang' : value === 'outbound' ? 'Ausgang' : 'Intern'
const aiRoleLabel = (value: DataFlow['aiRole']) => ({ ai_input: 'Input in AI-Tool', retrieval_context: 'Retrieval-Kontext', ai_output: 'AI-Output', tool_to_tool: 'Tool-zu-Tool', training_or_evaluation: 'Training / Evaluation' }[value])
const controlStatusLabel = (value: DataFlow['controlStatus']) => value === 'covered' ? 'Abgedeckt' : value === 'review_required' ? 'Prüfung erforderlich' : 'Blockiert'
const monitoringLabel = (value: DataFlow['monitoringStatus']) => value === 'expected' ? 'Erwarteter Flow' : value === 'observed' ? 'Runtime bestätigt' : value === 'deviation' ? 'Abweichung erkannt' : 'Nicht verbunden'
const gapTypeLabel = (value: DataFlowGapType) => ({ ai_without_input: 'AI ohne Input-Flow', external_uncontrolled: 'Externe Kontrolle', personal_unprotected: 'PII-Schutz', owner_missing: 'Owner fehlt', handoff_unclassified: 'Übergabe unklassifiziert' }[value])

function toolLabel(id?: string) {
  return props.tools.find((tool) => tool.id === id)?.name || id || 'Kein AI-Tool'
}

function targetProcesses(sourceProcessId: string) {
  return props.processes.filter((process) => process.id !== sourceProcessId)
}

interface LayoutResult {
  nodes: Node[]
  processPositions: Map<string, { x: number; y: number }>
  systemPositions: Map<string, { x: number; y: number }>
  width: number
  height: number
}

const layout = computed<LayoutResult>(() => {
  const compact = densityMode.value === 'overview'
  const processWidth = compact ? 206 : 248
  const processHeight = compact ? 82 : 134
  const processGap = compact ? 18 : 24
  const groupGap = compact ? 26 : 36
  const groupInset = compact ? 18 : 20
  const groupHeader = compact ? 48 : 52
  const columnsPerGroup = 3
  const groupWidth = (processCount: number) => {
    const columns = Math.min(columnsPerGroup, Math.max(1, processCount))
    return groupInset * 2 + columns * processWidth + Math.max(0, columns - 1) * processGap
  }
  const groupHeight = (processCount: number) => groupHeader + groupInset + Math.ceil(Math.max(1, processCount) / columnsPerGroup) * processHeight + Math.max(0, Math.ceil(processCount / columnsPerGroup) - 1) * processGap
  const groupsByLayer = new Map(layerMeta.map((layer) => {
    const layerProcesses = visibleProcesses.value.filter((process) => process.landscapeLayer === layer.id)
    const groups = [...new Set(layerProcesses.map((process) => process.domain))].sort((a, b) => a.localeCompare(b, 'de')).map((department) => ({
      department,
      processes: layerProcesses.filter((process) => process.domain === department).sort((a, b) => a.name.localeCompare(b.name, 'de'))
    }))
    return [layer.id, groups] as const
  }))
  const hasExternalSystemNodes = visibleDataFlows.value.some((item) => item.flow.isExternal && !item.target)
  const systemLaneWidth = hasExternalSystemNodes ? 230 : 0
  const bandWidth = (compact ? 1480 : 1280) + systemLaneWidth
  const bandGap = 28
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
      if (groupX > 58 && groupX + width > bandWidth - systemLaneWidth - 38) {
        groupX = 58
        groupY += rowHeight + groupGap
        rowHeight = 0
      }
      const departmentData = {
        name: group.department,
        count: group.processes.length,
        color: departmentColor(group.department),
        initials: initials(group.department)
      }
      nodes.push({
        id: `department-${layer.id}-${group.department}`,
        type: 'department',
        position: { x: groupX, y: groupY },
        data: departmentData,
        selectable: false,
        draggable: false,
        connectable: false,
        zIndex: -1,
        style: { width: `${width}px`, height: `${height}px` }
      })
      nodes.push({
        id: `department-label-${layer.id}-${group.department}`,
        type: 'departmentLabel',
        position: { x: groupX + width / 2, y: groupY + height / 2 },
        data: departmentData,
        selectable: false,
        draggable: false,
        connectable: false,
        zIndex: 6
      })

      group.processes.forEach((process, processIndex) => {
        const column = processIndex % columnsPerGroup
        const row = Math.floor(processIndex / columnsPerGroup)
        const position = { x: groupX + groupInset + column * (processWidth + processGap), y: groupY + groupHeader + row * (processHeight + processGap) }
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
            dataFlows: dataFlowStats(process.id).total,
            externalFlows: dataFlowStats(process.id).external,
            openFlows: dataFlowStats(process.id).open,
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

  const systemPositions = new Map<string, { x: number; y: number }>()
  const usedSystemY: number[] = []
  for (const item of visibleDataFlows.value.filter((entry) => entry.flow.isExternal && !entry.target)) {
    const processPosition = processPositions.get(item.source.id)
    if (!processPosition) continue
    let y = processPosition.y + 18
    while (usedSystemY.some((used) => Math.abs(used - y) < 68)) y += 72
    usedSystemY.push(y)
    const position = { x: bandWidth - 188, y }
    systemPositions.set(item.id, position)
    nodes.push({
      id: `system::${item.flow.id}`,
      type: 'externalSystem',
      position,
      data: {
        label: item.flow.direction === 'inbound' ? item.flow.sourceSystem : item.flow.targetSystem,
        tool: toolLabel(item.flow.aiToolId),
        status: item.flow.controlStatus
      },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: 4,
      style: { width: '154px', height: '58px' }
    })
  }

  return { nodes, processPositions, systemPositions, width: bandWidth, height: bandY + 12 }
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

const edges = computed<Edge[]>(() => {
  const hasFocus = Boolean(selectedRelationId.value || hoveredRelationId.value)
  const relationEdges = visibleRelations.value.flatMap((item) => {
    const sourcePosition = layout.value.processPositions.get(item.source.id)
    const targetPosition = layout.value.processPositions.get(item.target.id)
    if (!sourcePosition || !targetPosition) return []
    const color = edgeColor(item.relation.type)
    const isSelected = selectedRelationId.value === item.id
    const isHovered = hoveredRelationId.value === item.id
    return [{
      id: item.id,
      source: item.source.id,
      target: item.target.id,
      ...handlesFor(sourcePosition, targetPosition),
      type: 'smoothstep',
      label: showRelationLabels.value || isSelected || isHovered ? item.relation.label : undefined,
      animated: isSelected || isHovered,
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      style: { stroke: color, strokeWidth: isSelected || isHovered ? 3 : 1.8, opacity: hasFocus && !isSelected && !isHovered ? .18 : .88 },
      labelStyle: { fill: color, fontSize: 7.5, fontWeight: 700 },
      labelBgStyle: { fill: '#fff', fillOpacity: .96, stroke: color, strokeWidth: .4 },
      labelBgPadding: [6, 4],
      labelBgBorderRadius: 6,
      pathOptions: Math.abs(sourcePosition.y - targetPosition.y) < 50 ? { offset: 24, borderRadius: 8 } : { offset: 18, borderRadius: 8 },
      zIndex: isSelected || isHovered ? 3 : 2
    } satisfies Edge]
  })
  const dataFlowEdges = visibleDataFlows.value.flatMap((item) => {
    const processPosition = layout.value.processPositions.get(item.source.id)
    const targetProcessPosition = item.target ? layout.value.processPositions.get(item.target.id) : undefined
    const systemPosition = layout.value.systemPositions.get(item.id)
    if (!processPosition || (!targetProcessPosition && !systemPosition)) return []
    const color = sensitivityColors[item.flow.sensitivity]
    const isSelected = selectedRelationId.value === item.id
    const isHovered = hoveredRelationId.value === item.id
    const isInboundExternal = Boolean(systemPosition && item.flow.direction === 'inbound')
    const source = isInboundExternal ? `system::${item.flow.id}` : item.source.id
    const target = isInboundExternal ? item.source.id : item.target?.id || `system::${item.flow.id}`
    const indicators = [item.flow.isExternal ? 'EXT' : '', item.flow.controlStatus === 'review_required' ? 'PRÜFEN' : item.flow.controlStatus === 'blocked' ? 'BLOCKIERT' : ''].filter(Boolean).join(' · ')
    const label = showRelationLabels.value || isSelected || isHovered ? item.flow.label : indicators || undefined
    const positions = targetProcessPosition ? handlesFor(processPosition, targetProcessPosition) : {}
    return [{
      id: item.id,
      source,
      target,
      ...positions,
      type: 'smoothstep',
      label,
      animated: isSelected || isHovered,
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 17, height: 17 },
      style: {
        stroke: color,
        strokeWidth: isSelected || isHovered ? 3.4 : item.flow.controlStatus === 'review_required' ? 2.6 : 2,
        strokeDasharray: item.flow.isExternal ? '6 3' : undefined,
        opacity: hasFocus && !isSelected && !isHovered ? .16 : .94
      },
      labelStyle: { fill: color, fontSize: 7.5, fontWeight: 800 },
      labelBgStyle: { fill: '#fffef9', fillOpacity: .98, stroke: color, strokeWidth: .7 },
      labelBgPadding: [6, 4],
      labelBgBorderRadius: 0,
      pathOptions: { offset: 22, borderRadius: 6 },
      zIndex: isSelected || isHovered ? 5 : 3
    } satisfies Edge]
  })
  return [...relationEdges, ...dataFlowEdges]
})

const mapKey = computed(() => `${search.value}-${departmentFilter.value}-${statusFilter.value}-${layerFilter.value}-${flowQuestionFilter.value}-${densityMode.value}-${layoutRevision.value}`)
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

function handleViewportChange(viewport: { zoom: number }) {
  viewportZoom.value = viewport.zoom
}

function togglePortfolioKpis() {
  showPortfolioKpis.value = !showPortfolioKpis.value
  if (import.meta.client) localStorage.setItem(KPI_VISIBILITY_STORAGE_KEY, String(showPortfolioKpis.value))
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

function removeSelectedDataFlow() {
  if (!selectedDataFlow.value) return
  emit('removeDataFlow', selectedDataFlow.value.flow.id)
  selectedRelationId.value = ''
}

function updateSelectedDataFlow(patch: Partial<DataFlow>) {
  if (selectedDataFlow.value) emit('updateDataFlow', selectedDataFlow.value.flow.id, patch)
}

function updateStringList(field: 'dataCategories' | 'linkedPolicyIds' | 'linkedGuardrailIds', value: string) {
  updateSelectedDataFlow({ [field]: value.split(',').map((item) => item.trim()).filter(Boolean) })
}

function updateStringListEvent(field: 'dataCategories' | 'linkedPolicyIds' | 'linkedGuardrailIds', event: Event) {
  updateStringList(field, (event.target as HTMLInputElement).value)
}

function updateFlowField(field: keyof DataFlow, event: Event) {
  const value = (event.target as HTMLInputElement | HTMLSelectElement).value
  updateSelectedDataFlow({ [field]: value } as Partial<DataFlow>)
}

function updateFlowCheckbox(field: keyof DataFlow, event: Event) {
  updateSelectedDataFlow({ [field]: (event.target as HTMLInputElement).checked } as Partial<DataFlow>)
}

function focusGap(gap: { processId: string; dataFlowId?: string }) {
  search.value = ''
  departmentFilter.value = 'all'
  statusFilter.value = 'all'
  layerFilter.value = 'all'
  flowQuestionFilter.value = 'all'
  if (gap.dataFlowId) {
    selectedRelationId.value = `flow::${gap.dataFlowId}`
    nextTick(() => {
      refitMap()
      mapCard.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  } else {
    emit('openProcess', gap.processId)
  }
}

const flowActionLabel = computed(() => {
  const flow = selectedDataFlow.value?.flow
  if (!flow) return ''
  if (flow.controlStatus === 'blocked') return 'Blockiergrund dokumentieren'
  if (flow.controlStatus === 'review_required') return 'Kontrolle prüfen'
  return dataFlowIssues(flow).length ? 'Datenfluss vervollständigen' : 'Datenfluss vollständig'
})

function performFlowAction() {
  const flow = selectedDataFlow.value?.flow
  if (!flow) return
  if (flow.controlStatus === 'review_required' || flow.controlStatus === 'blocked') document.querySelector<HTMLElement>('.data-flow-detail textarea')?.focus()
  else document.querySelector<HTMLElement>('.data-flow-detail input, .data-flow-detail select')?.focus()
}

function minimapColor(node: Node) {
  if (node.type === 'departmentLabel') return 'transparent'
  if (node.type === 'externalSystem') return '#c23b54'
  if (node.type === 'landscapeProcess') {
    const process = (node.data as { process: BusinessProcess }).process
    return process.landscapeLayer === 'management' ? '#7557d3' : process.landscapeLayer === 'core' ? '#246bfd' : '#168a5b'
  }
  return '#e6ebf2'
}

onMounted(() => {
  showPortfolioKpis.value = localStorage.getItem(KPI_VISIBILITY_STORAGE_KEY) === 'true'
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
    <section class="kpi-disclosure" data-process-tour="portfolio-kpis">
      <button class="kpi-disclosure-toggle" :aria-expanded="showPortfolioKpis" aria-controls="portfolio-kpis" @click="togglePortfolioKpis">
        <span class="kpi-disclosure-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
        </span>
        <span><strong>Governance-Lücken</strong><small>{{ portfolioGaps.length }} konkrete Ausnahme(n) · {{ portfolioGaps.filter((gap) => gap.priority === 'high').length }} mit hoher Priorität · direkt navigierbar</small></span>
        <svg class="kpi-disclosure-chevron" :class="{ open: showPortfolioKpis }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 10 5 5 5-5"/></svg>
      </button>
      <Transition name="kpi-panel">
        <div v-if="showPortfolioKpis" id="portfolio-kpis" class="portfolio-gap-panel">
          <header>
            <div><strong>Priorisierte Ausnahmen</strong><span>Ein Eintrag führt direkt zum betroffenen Datenfluss oder Prozess.</span></div>
            <select v-model="gapTypeFilter" aria-label="Lückentyp filtern">
              <option value="all">Alle Lückentypen</option>
              <option value="ai_without_input">AI ohne Input-Flow</option>
              <option value="external_uncontrolled">Externe Kontrolle</option>
              <option value="personal_unprotected">PII-Schutz</option>
              <option value="owner_missing">Owner fehlt</option>
              <option value="handoff_unclassified">Übergabe unklassifiziert</option>
            </select>
          </header>
          <div v-if="visiblePortfolioGaps.length" class="portfolio-gap-list">
            <button v-for="gap in visiblePortfolioGaps" :key="gap.id" @click="focusGap(gap)">
              <i :class="`priority-${gap.priority}`">{{ gap.priority === 'high' ? 'Hoch' : 'Mittel' }}</i>
              <span><small>{{ gapTypeLabel(gap.type) }}</small><strong>{{ gap.title }}</strong><em>{{ gap.detail }}</em></span>
              <b>Öffnen →</b>
            </button>
          </div>
          <div v-else class="portfolio-gap-empty">Für diesen Filter bestehen keine offenen Governance-Lücken.</div>
        </div>
      </Transition>
    </section>

    <article ref="mapCard" class="card visual-map-card" data-process-tour="landscape-map" :class="{ 'visual-map-card--fullscreen': isFullscreen }">
      <header class="visual-map-head">
        <div>
          <p class="section-kicker">Interaktive Unternehmenskarte</p>
          <h2>AI Data Flow Map</h2>
          <span>Prozesse bleiben der Einstiegspunkt. Pfeile zeigen fachliche Übergaben und klassifizierte Datenströme zu Prozessen oder externen Systemen.</span>
        </div>
        <div class="map-actions">
          <div class="map-filter-tools">
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
            <select v-model="flowQuestionFilter" aria-label="Governance-Frage filtern" class="governance-question-filter">
              <option value="all">Alle Datenflüsse</option>
              <option value="external">Nur externe Ziele</option>
              <option value="personal">Nur personenbezogene Daten</option>
              <option value="open">Nur offene Kontrollen</option>
              <option value="ai">Nur mit AI-Tool</option>
              <option value="owner_missing">Nur ohne Owner</option>
            </select>
          </div>
          <div class="map-command-tools">
            <div class="density-switch" aria-label="Darstellungsdichte">
              <button :class="{ active: densityMode === 'overview' }" title="Reduzierte Karten für große Portfolios" @click="setDensity('overview')">Kompakt</button>
              <button :class="{ active: densityMode === 'detail' }" title="Alle Prozessdetails direkt auf den Karten" @click="setDensity('detail')">Detail</button>
            </div>
            <button class="button-secondary" :aria-pressed="showConnections" @click="showConnections = !showConnections">{{ showConnections ? 'Pfeile aus' : 'Pfeile an' }}</button>
            <div class="map-icon-tools" aria-label="Kartenwerkzeuge">
              <button class="button-secondary icon-tool-button" aria-label="Landkarte aufräumen" title="Landkarte automatisch anordnen" @click="tidyMap">
                <span class="broom-icon" aria-hidden="true">🧹</span>
              </button>
              <button class="button-secondary icon-tool-button fullscreen-button" :aria-label="isFullscreen ? 'Vollbild beenden' : 'Landkarte im Vollbild öffnen'" :title="isFullscreen ? 'Vollbild beenden (Esc)' : 'Landkarte im Vollbild öffnen'" @click="toggleFullscreen">
                <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></svg>
              </button>
            </div>
            <button @click="emit('createRelation')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              Verbindung
            </button>
          </div>
        </div>
      </header>

      <div class="relation-legend" data-process-tour="relations">
        <span class="zoom-state" :class="{ 'zoom-state--domains': isDomainZoom }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M3 12h3m12 0h3M12 3v3m0 12v3"/></svg>
          {{ isDomainZoom ? 'Bereichsansicht' : 'Prozessansicht' }}
        </span>
        <span v-if="densityMode === 'overview'" class="overview-note"><b>Übersichtsmodus</b> · {{ visibleProcesses.length }} Prozesse · Details per Klick</span>
        <button :class="{ active: relationFilter === 'all' }" @click="relationFilter = 'all'">Alle Verbindungen <b>{{ allRelations.length + allDataFlows.length }}</b></button>
        <button v-for="type in relationTypes" :key="type.id" :class="{ active: relationFilter === type.id }" :style="{ '--relation-color': type.color }" @click="relationFilter = type.id">
          <i /> {{ type.label }} <b>{{ type.id === 'data' ? allDataFlows.length : allRelations.filter((item) => item.relation.type === type.id).length }}</b>
        </button>
        <button class="label-toggle" :class="{ active: showRelationLabels }" :aria-pressed="showRelationLabels" @click="showRelationLabels = !showRelationLabels">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h10M4 18h7"/></svg>
          Pfeiltexte
        </button>
        <span>Pfeil wählen für Details · freie Fläche ziehen · scrollen zum Zoomen</span>
      </div>

      <div class="map-shell" :class="{ 'map-shell--detail': selectedRelation || selectedDataFlow, 'map-shell--overview': densityMode === 'overview' && visibleProcesses.length > 12, 'map-shell--domains': isDomainZoom }" :style="{ '--semantic-label-scale': semanticLabelScale }">
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
            @viewport-change="handleViewportChange"
            @node-click="handleNodeClick"
            @edge-click="handleEdgeClick"
            @edge-mouse-enter="handleEdgeMouseEnter"
            @edge-mouse-leave="handleEdgeMouseLeave"
            @pane-click="selectedRelationId = ''"
          >
            <template #node-landscapeLayer="nodeProps"><LandscapeLayerNode v-bind="nodeProps" /></template>
            <template #node-department="nodeProps"><DepartmentMapNode v-bind="nodeProps" /></template>
            <template #node-departmentLabel="nodeProps"><DepartmentMapLabelNode v-bind="nodeProps" /></template>
            <template #node-landscapeProcess="nodeProps"><LandscapeProcessNode v-bind="nodeProps" /></template>
            <template #node-externalSystem="nodeProps">
              <article class="external-system-node" :class="`external-system-node--${nodeProps.data.status}`">
                <small>Externer Empfänger</small>
                <strong>{{ nodeProps.data.label || 'Externes System' }}</strong>
                <span>{{ nodeProps.data.tool }}</span>
              </article>
            </template>
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

        <aside v-else-if="selectedDataFlow" class="relation-detail data-flow-detail">
          <header>
            <div><span :style="{ color: sensitivityColors[selectedDataFlow.flow.sensitivity] }">Datenfluss · {{ sensitivityLabel(selectedDataFlow.flow.sensitivity) }}</span><strong>Governance Contract</strong></div>
            <button @click="selectedRelationId = ''">×</button>
          </header>

          <div class="flow-detail-route">
            <span><small>Quelle</small><strong>{{ selectedDataFlow.flow.sourceSystem || selectedDataFlow.source.name }}</strong></span>
            <i>→</i>
            <span><small>{{ selectedDataFlow.flow.isExternal ? 'Externes Ziel' : 'Ziel' }}</small><strong>{{ selectedDataFlow.flow.targetSystem || selectedDataFlow.target?.name || 'Noch offen' }}</strong></span>
          </div>

          <div class="flow-detail-summary">
            <span><small>Daten</small><strong>{{ selectedDataFlow.flow.dataCategories.join(', ') || 'Noch nicht klassifiziert' }}</strong></span>
            <span><small>AI-Rolle</small><strong>{{ aiRoleLabel(selectedDataFlow.flow.aiRole) }}</strong></span>
            <span><small>AI-Tool</small><strong>{{ toolLabel(selectedDataFlow.flow.aiToolId) }}</strong></span>
            <span><small>Owner</small><strong>{{ selectedDataFlow.flow.owner || 'Fehlt' }}</strong></span>
          </div>

          <div class="flow-detail-form">
            <label><span>Bezeichnung</span><input :value="selectedDataFlow.flow.label" @change="updateFlowField('label', $event)" /></label>
            <label><span>Quellsystem</span><input :value="selectedDataFlow.flow.sourceSystem" @change="updateFlowField('sourceSystem', $event)" /></label>
            <label><span>Zielprozess (optional)</span><select :value="selectedDataFlow.flow.targetProcessId || ''" @change="updateFlowField('targetProcessId', $event)"><option value="">Kein Zielprozess</option><option v-for="process in targetProcesses(selectedDataFlow.flow.sourceProcessId)" :key="process.id" :value="process.id">{{ process.name }}</option></select></label>
            <label><span>Zielsystem / Anbieter</span><input :value="selectedDataFlow.flow.targetSystem" @change="updateFlowField('targetSystem', $event)" /></label>
            <label><span>Datenkategorien · kommagetrennt</span><input :value="selectedDataFlow.flow.dataCategories.join(', ')" @change="updateStringListEvent('dataCategories', $event)" /></label>
            <label><span>Sensitivität</span><select :value="selectedDataFlow.flow.sensitivity" @change="updateFlowField('sensitivity', $event)"><option value="unclassified">Nicht klassifiziert</option><option value="public">Öffentlich</option><option value="internal">Intern</option><option value="confidential">Vertraulich</option><option value="personal">Personenbezogen</option></select></label>
            <label><span>Richtung</span><select :value="selectedDataFlow.flow.direction" @change="updateFlowField('direction', $event)"><option value="inbound">Eingang</option><option value="outbound">Ausgang</option><option value="internal">Intern</option></select></label>
            <label><span>AI-Rolle</span><select :value="selectedDataFlow.flow.aiRole" @change="updateFlowField('aiRole', $event)"><option value="ai_input">Input in AI-Tool</option><option value="retrieval_context">Retrieval-Kontext</option><option value="ai_output">AI-Output</option><option value="tool_to_tool">Tool-zu-Tool</option><option value="training_or_evaluation">Training / Evaluation</option></select></label>
            <label><span>AI-Tool</span><select :value="selectedDataFlow.flow.aiToolId || ''" @change="updateFlowField('aiToolId', $event)"><option value="">Kein AI-Tool</option><option v-for="tool in tools.filter((item) => item.category === 'AI-Modell')" :key="tool.id" :value="tool.id">{{ tool.name }} · {{ tool.vendor }}</option></select></label>
            <label><span>Owner</span><input :value="selectedDataFlow.flow.owner" @change="updateFlowField('owner', $event)" /></label>
            <label><span>Kontrollstatus</span><select :value="selectedDataFlow.flow.controlStatus" @change="updateFlowField('controlStatus', $event)"><option value="covered">Abgedeckt</option><option value="review_required">Prüfung erforderlich</option><option value="blocked">Blockiert</option></select></label>
            <label class="flow-detail-form--full"><span>Kontrollnachweis / Blockiergrund</span><textarea :value="selectedDataFlow.flow.controlNote" rows="2" @change="updateFlowField('controlNote', $event)" /></label>
            <label><span>Policy-IDs · kommagetrennt</span><input :value="selectedDataFlow.flow.linkedPolicyIds.join(', ')" @change="updateStringListEvent('linkedPolicyIds', $event)" /></label>
            <label><span>Guardrail-/PII-Tool-IDs</span><input :value="selectedDataFlow.flow.linkedGuardrailIds.join(', ')" @change="updateStringListEvent('linkedGuardrailIds', $event)" /></label>
            <label><span>Monitoring-Evidenz</span><select :value="selectedDataFlow.flow.monitoringStatus" @change="updateFlowField('monitoringStatus', $event)"><option value="not_connected">Nicht verbunden</option><option value="expected">Erwarteter Flow</option><option value="observed">Runtime bestätigt</option><option value="deviation">Abweichung erkannt</option></select></label>
            <label class="external-toggle"><input type="checkbox" :checked="selectedDataFlow.flow.isExternal" @change="updateFlowCheckbox('isExternal', $event)" /><span>Externes Ziel</span></label>
          </div>

          <div class="flow-control-state" :class="`flow-control-state--${selectedDataFlow.flow.controlStatus}`">
            <strong>{{ controlStatusLabel(selectedDataFlow.flow.controlStatus) }}</strong>
            <span>{{ selectedDataFlow.flow.controlNote || 'Kontrollnachweis noch ergänzen.' }}</span>
            <small>{{ monitoringLabel(selectedDataFlow.flow.monitoringStatus) }}</small>
          </div>
          <div v-if="dataFlowIssues(selectedDataFlow.flow).length" class="flow-detail-issues"><span v-for="issue in dataFlowIssues(selectedDataFlow.flow)" :key="issue">{{ issue }}</span></div>
          <button class="flow-primary-action" :disabled="!dataFlowIssues(selectedDataFlow.flow).length && selectedDataFlow.flow.controlStatus === 'covered'" @click="performFlowAction">{{ flowActionLabel }}</button>
          <button class="delete-relation" @click="removeSelectedDataFlow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/></svg>
            Datenfluss entfernen
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
.landscape-view { min-width: 0; display: grid; gap: 20px; container-type: inline-size; }.kpi-disclosure { min-width: 0; border: 1px solid var(--border-strong); background: var(--surface); }.kpi-disclosure-toggle { width: 100%; min-height: 52px; padding: 8px 14px; display: flex; align-items: center; gap: 11px; border: 0; background: var(--surface-soft); color: var(--text); text-align: left; }.kpi-disclosure-toggle:hover { border: 0; background: #e3e0d7; color: var(--text); transform: none; }.kpi-disclosure-toggle > span:nth-child(2) { min-width: 0; display: flex; flex: 1; flex-direction: column; }.kpi-disclosure-toggle strong { font-size: 11.5px; }.kpi-disclosure-toggle small { margin-top: 2px; overflow: hidden; color: var(--muted); font-size: 9.5px; text-overflow: ellipsis; white-space: nowrap; }.kpi-disclosure-icon { width: 31px; height: 31px; flex: 0 0 auto; display: grid; place-items: center; border: 1px solid var(--ink); background: var(--acid); }.kpi-disclosure-icon svg { width: 17px; }.kpi-disclosure-chevron { width: 16px; transition: transform 160ms; }.kpi-disclosure-chevron.open { transform: rotate(180deg); }.kpi-panel-enter-active, .kpi-panel-leave-active { overflow: hidden; transition: opacity 160ms, transform 160ms; }.kpi-panel-enter-from, .kpi-panel-leave-to { opacity: 0; transform: translateY(-5px); }.map-kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; border-top: 1px solid var(--border-strong); }.map-kpis article { min-height: 96px; padding: 15px 16px; display: flex; align-items: center; gap: 12px; border: 0; border-left: 1px solid var(--border); border-radius: 0; background: transparent; box-shadow: none; }.map-kpis article:first-child { border-left: 0; }.map-kpis article > div { min-width: 0; display: flex; flex-direction: column; }.map-kpis article > div > span { color: var(--muted); font-size: 8px; font-weight: 700; }.map-kpis strong { margin-top: 2px; font-family: 'Space Grotesk', sans-serif; font-size: 23px; }.map-kpis small { margin-top: 2px; color: var(--muted-light); font-size: 7px; }.kpi-icon { width: 37px; height: 37px; flex: 0 0 auto; display: grid; place-items: center; border: 1px solid currentColor; border-radius: 0; background: transparent; font-size: 9px; font-weight: 800; }.kpi-icon--blue { color: var(--accent); background: transparent; }.kpi-icon--green { color: var(--ok); background: transparent; }.kpi-icon--purple { color: var(--purple); background: transparent; }.kpi-icon--amber { color: var(--warn); background: transparent; }
.portfolio-gap-panel { border-top: 1px solid var(--border-strong); background: var(--surface); }.portfolio-gap-panel > header { padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #dcd9d0; }.portfolio-gap-panel > header > div { display: flex; flex-direction: column; }.portfolio-gap-panel > header strong { font-size: 12px; }.portfolio-gap-panel > header span { margin-top: 3px; color: var(--muted); font-size: 9.5px; }.portfolio-gap-panel select { min-height: 36px; font-size: 10px; }.portfolio-gap-list { max-height: 330px; overflow-y: auto; }.portfolio-gap-list button { width: 100%; min-height: 66px; padding: 10px 14px; display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; align-items: center; gap: 12px; border: 0; border-top: 1px solid var(--border); background: var(--surface); color: var(--text); text-align: left; }.portfolio-gap-list button:hover { border-color: var(--border); background: var(--surface-soft); color: var(--text); transform: none; }.portfolio-gap-list button > i { padding: 5px; font-size: 8px; font-style: normal; font-weight: 800; text-align: center; }.portfolio-gap-list .priority-high { background: var(--err-soft); color: var(--err); }.portfolio-gap-list .priority-medium { background: var(--warn-soft); color: var(--warn); }.portfolio-gap-list button > span { min-width: 0; display: flex; flex-direction: column; }.portfolio-gap-list small { color: var(--purple); font-size: 8px; font-weight: 800; text-transform: uppercase; }.portfolio-gap-list strong { margin-top: 2px; font-size: 11px; }.portfolio-gap-list em { margin-top: 3px; overflow: hidden; color: var(--muted); font-size: 9px; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }.portfolio-gap-list b { color: var(--accent); font-size: 9px; }.portfolio-gap-empty { padding: 25px; color: var(--ok); font-size: 11px; text-align: center; }
.visual-map-card { min-width: 0; padding: 0; overflow: hidden; container-type: inline-size; }.visual-map-head { min-height: 82px; padding: 14px 17px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--border-strong); }.visual-map-head > div:first-child { min-width: 0; }.section-kicker { margin: 0; color: var(--accent); font-size: 7.5px; font-weight: 800; letter-spacing: .9px; text-transform: uppercase; }.visual-map-head h2 { margin: 3px 0 1px; font-size: 17px; }.visual-map-head > div > span { color: var(--muted); font-size: 7.5px; }.map-actions { min-width: 0; display: grid; justify-items: end; gap: 7px; }.map-filter-tools, .map-command-tools { min-width: 0; display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 6px; }.map-actions select { width: 110px; min-height: 34px; padding: 0 8px; font-size: 7.3px; }.map-filter-tools select:first-of-type { width: 132px; }.map-command-tools > button { min-height: 34px; padding: 0 10px; font-size: 7.7px; white-space: nowrap; }.map-command-tools > button svg { width: 13px; }.map-icon-tools { display: flex; align-items: center; gap: 4px; }.map-command-tools .icon-tool-button { width: 40px; min-width: 40px; min-height: 40px; padding: 0; }.map-command-tools .icon-tool-button svg { width: 17px; }.map-actions .fullscreen-button { border-color: var(--ink); background: transparent; color: var(--text); }.map-actions .fullscreen-button:hover { border-color: var(--ink); background: var(--ink); color: var(--paper); }.map-search { width: 168px; min-width: 0; min-height: 34px; padding: 0 9px; display: flex; align-items: center; gap: 6px; border: 1px solid var(--border-strong); border-radius: 0; }.map-search svg { width: 12px; flex: 0 0 auto; color: var(--muted-light); }.map-search input { width: 100%; min-width: 0; min-height: 29px; padding: 0; border: 0; outline: 0; font-size: 7.3px; }
.density-switch { min-height: 34px; padding: 3px; display: flex; align-items: center; border: 1px solid var(--border-strong); background: var(--surface-raised); }.density-switch button { min-height: 32px; padding: 0 9px; border: 0; background: transparent; color: var(--muted); font-size: 7.7px; }.density-switch button:hover { border: 0; background: var(--surface-muted); color: var(--text); transform: none; }.density-switch button.active { background: var(--ink); color: var(--acid); }
.map-actions .governance-question-filter { width: 165px; }
.relation-legend { min-height: 42px; padding: 6px 12px; display: flex; align-items: center; gap: 4px; border-bottom: 1px solid var(--border); background: #ebe8df; overflow-x: auto; }.relation-legend button { min-height: 27px; padding: 0 8px; flex: 0 0 auto; border-radius: 0; border-color: transparent; background: transparent; color: var(--muted); font-size: 6.7px; }.relation-legend button:hover { border-color: transparent; background: var(--paper); color: var(--text); transform: none; }.relation-legend button.active { border-color: var(--ink); background: var(--ink); color: var(--paper); box-shadow: none; }.relation-legend button i { width: 13px; height: 2px; display: inline-block; background: var(--relation-color, #64748b); vertical-align: middle; }.relation-legend button b { margin-left: 3px; }.relation-legend .label-toggle { margin-left: 4px; border-left: 1px solid var(--border); border-radius: 0; }.relation-legend .label-toggle svg { width: 11px; }.relation-legend > span { margin-left: auto; flex: 0 0 auto; color: var(--muted-light); font-size: 6.3px; }.relation-legend .zoom-state { min-height: 28px; margin: 0 8px 0 0; padding: 0 8px; display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-weight: 800; white-space: nowrap; }.relation-legend .zoom-state svg { width: 12px; }.relation-legend .zoom-state--domains { border-color: var(--blue); background: var(--accent-soft); color: #354dcc; }.relation-legend .overview-note { margin: 0 8px 0 0; padding-right: 12px; border-right: 1px solid var(--border-strong); color: var(--text); }.overview-note b { color: #354dcc; }
.map-shell { height: 700px; position: relative; display: grid; grid-template-columns: minmax(0, 1fr); background: #f1efe8; transition: 180ms; }.map-shell--overview { height: 960px; }.landscape-flow { min-width: 0; width: 100%; height: 100%; }.landscape-flow :deep(.vue-flow__node) { width: auto; padding: 0; border: 0; background: transparent; box-shadow: none; }.landscape-flow :deep(.vue-flow__node-landscapeProcess), .landscape-flow :deep(.vue-flow__node-externalSystem) { transition: opacity 180ms; }.landscape-flow :deep(.vue-flow__node.selected) { box-shadow: none; }.landscape-flow :deep(.vue-flow__edge-path) { filter: none; transition: opacity 140ms, stroke-width 140ms; }.landscape-flow :deep(.vue-flow__edge.selected .vue-flow__edge-path) { filter: drop-shadow(0 2px 3px rgba(92,118,255,.24)); }.landscape-flow :deep(.vue-flow__edge-label) { font-family: 'DM Sans', sans-serif; }.map-shell--domains .landscape-flow :deep(.vue-flow__node-landscapeProcess) { opacity: 0; pointer-events: none; }.map-shell--domains .landscape-flow :deep(.vue-flow__node-externalSystem) { opacity: 0; pointer-events: none; }.map-shell--domains .landscape-flow :deep(.vue-flow__edge-path) { stroke-width: 3px !important; opacity: .92 !important; }.map-shell--domains .landscape-flow :deep(.vue-flow__edge-label) { display: none; }.map-shell--domains .landscape-flow :deep(.department-island) { border-width: 2px; background: color-mix(in srgb, var(--department-color) 11%, rgba(248,246,239,.97)); }.map-shell--domains .landscape-flow :deep(.department-island header) { width: max-content; min-width: 220px; transform: scale(1.32); transform-origin: top left; box-shadow: 2px 2px 0 rgba(23,23,20,.1); }.map-shell--domains .landscape-flow :deep(.map-layer > div) { transform: scale(1.22); transform-origin: top left; }.landscape-flow :deep(.vue-flow__controls) { overflow: hidden; border: 1px solid var(--ink); border-radius: 0; box-shadow: none; }.landscape-flow :deep(.vue-flow__controls-button) { width: 28px; height: 28px; border-color: var(--border); background: var(--paper); color: var(--text); }.landscape-flow :deep(.vue-flow__minimap) { width: 118px; height: 76px; overflow: hidden; border: 1px solid var(--ink); border-radius: 0; background: rgba(241,239,232,.94); box-shadow: none; }.map-loading, .map-empty { position: absolute; inset: 0; display: grid; place-content: center; background: #f1efe8; color: var(--muted); text-align: center; }.map-empty { z-index: 10; }.map-empty strong { font-size: 11px; }.map-empty span { margin-top: 4px; font-size: 8px; }
.relation-detail { width: 276px; padding: 16px; position: absolute; z-index: 8; top: 12px; right: 12px; bottom: 12px; overflow-y: auto; border: 1px solid var(--border); border-radius: 12px; background: rgba(255,255,255,.97); box-shadow: 0 16px 40px rgba(20,34,56,.16); backdrop-filter: blur(8px); }.relation-detail > header { display: flex; justify-content: space-between; }.relation-detail > header > div { display: flex; flex-direction: column; }.relation-detail > header span { font-size: 7px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; }.relation-detail > header strong { margin-top: 3px; font-size: 13px; }.relation-detail > header button { width: 27px; min-height: 27px; padding: 0; border-color: transparent; background: transparent; color: var(--muted); font-size: 17px; }.detail-process { width: 100%; min-height: 65px; margin-top: 18px; padding: 11px; align-items: flex-start; flex-direction: column; border-color: var(--border); background: #f9fbfd; color: var(--text); text-align: left; }.detail-process:hover { border-color: #afc0d8; background: #fff; color: var(--text); transform: none; }.detail-process small { color: var(--accent); font-size: 6px; font-weight: 800; text-transform: uppercase; }.detail-process strong { margin-top: 4px; font-size: 9px; }.detail-arrow { height: 32px; display: flex; align-items: center; justify-content: center; flex-direction: column; font-size: 10px; }.detail-arrow i { width: 1px; height: 13px; background: currentColor; }.detail-handoff { padding: 11px; border: 1px solid #dce4ef; border-radius: 8px; background: #fff; text-align: center; }.detail-handoff small { display: block; color: var(--muted-light); font-size: 6px; font-weight: 700; text-transform: uppercase; }.detail-handoff strong { margin-top: 4px; display: block; font-size: 8px; line-height: 1.4; }.delete-relation { width: 100%; margin-top: 20px; border-color: #f0c9c9; background: var(--err-soft); color: var(--err); }.delete-relation:hover { border-color: #e8aaaa; background: #ffe8e8; color: var(--err); }.delete-relation svg { width: 13px; }
.external-system-node { width: 154px; min-height: 58px; padding: 8px 10px; display: flex; justify-content: center; flex-direction: column; border: 1px dashed #c23b54; border-left: 4px solid #c23b54; background: #fff8f8; color: var(--text); box-shadow: 2px 2px 0 rgba(23,23,20,.08); }.external-system-node small { color: #c23b54; font-size: 7px; font-weight: 800; text-transform: uppercase; }.external-system-node strong { margin-top: 3px; overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.external-system-node span { margin-top: 2px; overflow: hidden; color: var(--muted); font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }.external-system-node--review_required { border-top: 3px solid var(--warn); }.external-system-node--blocked { border-top: 3px solid var(--err); background: var(--err-soft); }
.data-flow-detail { width: 360px; }.flow-detail-route { margin-top: 15px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: stretch; gap: 5px; }.flow-detail-route > span { min-width: 0; padding: 8px; display: flex; flex-direction: column; border: 1px solid var(--border-strong); background: var(--surface); }.flow-detail-route > i { display: grid; place-items: center; color: var(--purple); font-style: normal; }.flow-detail-route small, .flow-detail-summary small { color: var(--muted); font-size: 7.5px; font-weight: 800; text-transform: uppercase; }.flow-detail-route strong { margin-top: 3px; overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.flow-detail-summary { margin-top: 9px; display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--border); }.flow-detail-summary > span { min-width: 0; padding: 8px; display: flex; flex-direction: column; border-top: 1px solid var(--border); border-left: 1px solid var(--border); }.flow-detail-summary > span:nth-child(-n+2) { border-top: 0; }.flow-detail-summary > span:nth-child(odd) { border-left: 0; }.flow-detail-summary strong { margin-top: 3px; overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.flow-detail-form { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }.flow-detail-form label { min-width: 0; display: flex; flex-direction: column; gap: 4px; }.flow-detail-form label > span { color: var(--muted); font-size: 8px; font-weight: 700; }.flow-detail-form input, .flow-detail-form select, .flow-detail-form textarea { width: 100%; min-height: 34px; padding: 6px 7px; font-size: 9px; }.flow-detail-form--full { grid-column: 1 / -1; }.flow-detail-form .external-toggle { min-height: 34px; padding: 7px; align-items: center; flex-direction: row; border: 1px solid var(--border); }.flow-detail-form .external-toggle input { width: auto; min-height: auto; }.flow-control-state { margin-top: 12px; padding: 9px; display: flex; flex-direction: column; border-left: 4px solid var(--ok); background: var(--ok-soft); }.flow-control-state--review_required { border-color: var(--warn); background: var(--warn-soft); }.flow-control-state--blocked { border-color: var(--err); background: var(--err-soft); }.flow-control-state strong { font-size: 10px; }.flow-control-state span { margin-top: 3px; color: var(--muted); font-size: 8.5px; line-height: 1.4; }.flow-control-state small { margin-top: 5px; font-size: 8px; font-weight: 800; }.flow-detail-issues { margin-top: 9px; display: flex; flex-wrap: wrap; gap: 4px; }.flow-detail-issues span { padding: 4px 5px; background: var(--err-soft); color: var(--err); font-size: 7.5px; font-weight: 700; }.flow-primary-action { width: 100%; margin-top: 12px; }.flow-primary-action:disabled { background: var(--ok-soft); color: var(--ok); opacity: 1; }
.visual-map-card--fullscreen { width: 100vw; height: 100vh; position: fixed; z-index: 1000; inset: 0; display: grid; grid-template-rows: auto auto minmax(0, 1fr); border: 0; border-radius: 0; background: #fff; box-shadow: none; }.visual-map-card--fullscreen .visual-map-head { min-height: 70px; padding: 11px 16px; }.visual-map-card--fullscreen .map-shell { height: auto; min-height: 0; }.visual-map-card:fullscreen { width: 100vw; height: 100vh; display: grid; grid-template-rows: auto auto minmax(0, 1fr); border: 0; border-radius: 0; background: #fff; }.visual-map-card:fullscreen .map-shell { height: auto; min-height: 0; }
@media (max-width: 1180px) { .map-kpis { grid-template-columns: 1fr 1fr; }.visual-map-head { align-items: flex-start; flex-direction: column; }.map-actions { width: 100%; flex-wrap: wrap; }.map-search { flex: 1; }.map-shell { height: 680px; }.visual-map-card--fullscreen .visual-map-head, .visual-map-card:fullscreen .visual-map-head { align-items: center; flex-direction: row; }.visual-map-card--fullscreen .map-actions, .visual-map-card:fullscreen .map-actions { width: auto; } }
@media (max-width: 760px) { .map-kpis { grid-template-columns: 1fr; }.map-kpis article { min-height: 75px; }.map-actions { flex-direction: column; }.map-search, .map-actions select, .map-actions select:nth-child(2), .map-actions > button { width: 100%; }.relation-legend > span { display: none; }.map-shell { height: 700px; }.map-shell--overview { height: 840px; }.relation-detail { width: calc(100% - 20px); height: auto; max-height: 62%; top: auto; right: 10px; bottom: 10px; left: 10px; }.detail-process { margin-top: 12px; }.detail-arrow { height: 22px; }.detail-arrow i { height: 9px; }.visual-map-card--fullscreen .visual-map-head, .visual-map-card:fullscreen .visual-map-head { max-height: 42vh; align-items: flex-start; flex-direction: column; overflow-y: auto; }.visual-map-card--fullscreen .map-actions, .visual-map-card:fullscreen .map-actions { width: 100%; flex-direction: row; }.visual-map-card--fullscreen .map-search, .visual-map-card:fullscreen .map-search { width: 100%; flex-basis: 100%; }.visual-map-card--fullscreen .map-actions select, .visual-map-card--fullscreen .map-actions > button, .visual-map-card:fullscreen .map-actions select, .visual-map-card:fullscreen .map-actions > button { width: auto; flex: 1; } }
.relation-detail { border-color: var(--ink); border-radius: 0; background: rgba(248,246,239,.97); box-shadow: 8px 8px 0 rgba(23,23,20,.1); }
.visual-map-card--fullscreen, .visual-map-card:fullscreen { background: var(--paper); }

/* The portfolio summary and map tools form separate, readable planes. */
.map-kpis { border: 0; background: var(--surface); }
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
.map-command-tools > button { min-height: 40px; font-size: 10.5px; }
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
.broom-icon { font-size: 16px; line-height: 1; }

/* Keep domain and layer names legible while the canvas itself is scaled down. */
.map-shell--domains .landscape-flow :deep(.department-island header) {
  display: none;
}
.landscape-flow :deep(.vue-flow__node-departmentLabel) {
  opacity: 0;
  pointer-events: none;
  transition: opacity 160ms;
}
.map-shell--domains .landscape-flow :deep(.vue-flow__node-departmentLabel) {
  opacity: 1;
}
.map-shell--domains .landscape-flow :deep(.map-layer > div) {
  transform: scale(var(--semantic-label-scale, 1.7));
  transform-origin: top left;
}

@container (max-width: 1250px) {
  .visual-map-head { align-items: stretch; flex-direction: column; gap: 15px; }
  .visual-map-head > div:first-child { max-width: 720px; }
  .map-actions { width: 100%; justify-items: stretch; }
  .map-filter-tools { display: grid; grid-template-columns: minmax(190px, 1.6fr) repeat(4, minmax(120px, 1fr)); }
  .map-search, .map-actions select, .map-filter-tools select:first-of-type { width: 100%; }
  .map-command-tools { justify-content: flex-end; }
}

@container (max-width: 1000px) {
  .map-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .map-kpis article:nth-child(odd) { border-left: 0; }
  .relation-legend > span { display: none; }
}

@container (max-width: 760px) {
  .map-filter-tools { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .map-search { grid-column: 1 / -1; width: 100%; }
  .map-command-tools { justify-content: flex-start; }
  .relation-legend .zoom-state { display: inline-flex; }
}

@container (max-width: 520px) {
  .map-kpis, .map-filter-tools { grid-template-columns: 1fr; }
  .map-search { grid-column: auto; }
  .map-kpis article { border-left: 0; }
  .density-switch button { flex: 1; }
  .map-command-tools { display: grid; grid-template-columns: 1fr auto auto; }
  .map-command-tools > button:last-child { grid-column: 1 / -1; }
}
</style>
