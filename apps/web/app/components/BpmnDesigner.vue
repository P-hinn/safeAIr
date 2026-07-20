<script setup lang="ts">
import type { ProcessStep } from '~/composables/useProcessMap'
import safairModdle from '~/utils/safair-moddle'

const props = withDefaults(defineProps<{
  xml: string
  selectedElementId?: string
  governanceSteps?: ProcessStep[]
  readonly?: boolean
}>(), {
  selectedElementId: '',
  governanceSteps: () => [],
  readonly: false
})

const emit = defineEmits<{
  changed: [xml: string]
  selected: [elementId: string]
  error: [message: string]
}>()

const canvasElement = ref<HTMLDivElement>()
let instance: any
let loading = false
let saveTimer: ReturnType<typeof setTimeout> | undefined
let lastXml = ''

const executionModes = {
  manual: { label: 'Manuell', className: 'manual' },
  rule_automated: { label: 'Technisch automatisiert', className: 'rule-automated' },
  ai_assisted: { label: 'KI-assistiert', className: 'ai-assisted' },
  ai_autonomous: { label: 'KI-autonom', className: 'ai-autonomous' }
} as const

const executionMarkers = Object.values(executionModes).map((mode) => `safair-mode-${mode.className}`)

function isBpmnActivity(businessObject: any) {
  if (typeof businessObject?.$instanceOf === 'function') return businessObject.$instanceOf('bpmn:Activity')
  return /(?:Task|SubProcess|CallActivity)$/.test(String(businessObject?.$type ?? ''))
}

function service<T = any>(name: string): T | undefined {
  try {
    return instance?.get(name) as T
  } catch {
    return undefined
  }
}

function renderOverlays() {
  const overlays = service<any>('overlays')
  const registry = service<any>('elementRegistry')
  const canvas = service<any>('canvas')
  if (!overlays || !registry || !canvas) return
  overlays.clear()
  const governanceById = new Map(props.governanceSteps.map((step) => [step.id, step]))
  for (const element of registry.getAll()) {
    const businessObject = element.businessObject
    const governance = governanceById.get(element.id)
    executionMarkers.forEach((marker) => canvas.removeMarker(element.id, marker))
    if (!businessObject || element.labelTarget || !isBpmnActivity(businessObject)) continue

    const modeKey = String(governance?.executionMode || businessObject.executionMode || 'manual') as keyof typeof executionModes
    const mode = executionModes[modeKey] ?? executionModes.manual
    const automationPotential = governance?.automationPotential ?? businessObject.automationPotential
    const humanApproval = governance?.humanApproval ?? businessObject.humanApproval === true
    const riskLevel = governance?.risk ?? businessObject.risk
    canvas.addMarker(element.id, `safair-mode-${mode.className}`)

    const badge = document.createElement('span')
    badge.className = `safair-bpmn-state safair-bpmn-state--${mode.className}`

    const modeLabel = document.createElement('span')
    modeLabel.className = 'safair-bpmn-state__mode'
    modeLabel.textContent = mode.label
    badge.append(modeLabel)

    if (modeKey === 'manual' && automationPotential && automationPotential !== 'none') {
      const potential = document.createElement('span')
      potential.className = 'safair-bpmn-state__flag is-potential'
      potential.textContent = '↗'
      potential.title = automationPotential === 'full' ? 'Voll automatisierbar' : 'Teilweise automatisierbar'
      badge.append(potential)
    }
    if (humanApproval) {
      const approval = document.createElement('span')
      approval.className = 'safair-bpmn-state__flag is-approval'
      approval.textContent = '✓ Human'
      approval.title = 'Manuelle Freigabe erforderlich'
      badge.append(approval)
    }
    if (riskLevel === 'high') {
      const risk = document.createElement('span')
      risk.className = 'safair-bpmn-state__flag is-risk'
      risk.textContent = '!'
      risk.title = 'Hohes Risiko'
      badge.append(risk)
    }

    const detail = [
      `Ausführung: ${mode.label}`,
      automationPotential && automationPotential !== 'none' ? `Automatisierungspotenzial: ${automationPotential}` : '',
      humanApproval ? 'Manuelle Freigabe' : '',
      riskLevel ? `Risiko: ${riskLevel}` : ''
    ].filter(Boolean)
    badge.title = detail.join(' · ')
    overlays.add(element, { position: { top: -18, left: 5 }, html: badge, scale: { min: 0.75, max: 1.2 } })
  }
}

async function currentXml() {
  if (!instance) return props.xml
  const result = await instance.saveXML({ format: true })
  return result.xml as string
}

async function notifyChange() {
  if (loading || props.readonly) return
  const xml = await currentXml()
  lastXml = xml
  renderOverlays()
  emit('changed', xml)
}

async function importXml(xml: string, fit = true) {
  if (!instance || !xml) return
  loading = true
  try {
    await instance.importXML(xml)
    lastXml = xml
    renderOverlays()
    if (fit) requestAnimationFrame(() => service<any>('canvas')?.zoom('fit-viewport'))
  } catch (error) {
    emit('error', error instanceof Error ? error.message : 'BPMN-Dokument konnte nicht geladen werden.')
  } finally {
    loading = false
  }
}

function fitView() {
  const canvas = service<any>('canvas')
  if (!canvas) return
  canvas.resized?.()
  requestAnimationFrame(() => {
    canvas.resized?.()
    canvas.zoom('fit-viewport')
  })
}

function selectElement(id: string) {
  const element = service<any>('elementRegistry')?.get(id)
  const selection = service<any>('selection')
  if (element && selection) selection.select(element)
}

function updateGovernance(step: ProcessStep) {
  if (props.readonly) return
  const element = service<any>('elementRegistry')?.get(step.id)
  const modeling = service<any>('modeling')
  const moddle = service<any>('moddle')
  if (!element || !modeling || !moddle) return
  const businessObject = element.businessObject
  const properties = {
    name: step.title,
    owner: step.owner,
    department: step.department,
    risk: step.risk,
    executionMode: step.executionMode,
    automationPotential: step.automationPotential,
    humanApproval: step.humanApproval,
    control: step.control,
    toolIds: step.toolIds.join(','),
    workflowType: step.workflowType
  }
  const documentationText = businessObject.documentation?.[0]?.text ?? ''
  const unchanged = Object.entries(properties).every(([key, value]) => businessObject[key] === value)
    && documentationText === step.description
  if (unchanged) return
  const documentation = moddle.create('bpmn:Documentation', { text: step.description })
  modeling.updateProperties(element, { ...properties, documentation: [documentation] })
}

onMounted(async () => {
  if (!canvasElement.value) return
  const module = props.readonly
    ? await import('bpmn-js/lib/NavigatedViewer')
    : await import('bpmn-js/lib/Modeler')
  const Constructor = module.default
  instance = new Constructor({
    container: canvasElement.value,
    moddleExtensions: { safair: safairModdle }
  })
  instance.on('selection.changed', (event: { newSelection?: Array<{ id: string; businessObject?: { $type?: string } }> }) => {
    const element = event.newSelection?.[0]
    if (element?.id && element.businessObject?.$type !== 'bpmn:Lane' && element.businessObject?.$type !== 'bpmn:Participant') emit('selected', element.id)
  })
  if (!props.readonly) {
    instance.on('commandStack.changed', () => {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(notifyChange, 220)
    })
  }
  await importXml(props.xml)
})

watch(() => props.xml, async (xml) => {
  if (!instance || !xml || xml === lastXml) return
  await importXml(xml)
})

watch(() => props.selectedElementId, (id) => {
  if (id) selectElement(id)
})

watch(() => props.governanceSteps, renderOverlays, { deep: true })

onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  instance?.destroy()
  instance = undefined
})

defineExpose({ currentXml, importXml, fitView, selectElement, updateGovernance })
</script>

<template>
  <div ref="canvasElement" class="bpmn-designer" :class="{ 'is-readonly': readonly }" />
</template>

<style>
@import 'bpmn-js/dist/assets/diagram-js.css';
@import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

.bpmn-designer {
  width: 100%;
  height: 100%;
  min-height: 560px;
  background: #f1efe8;
}

.bpmn-designer.is-readonly { min-height: 300px; }
.bpmn-designer .djs-palette { overflow: hidden; border: 1px solid #171714; border-radius: 0; background: #fffef9; box-shadow: 4px 4px 0 rgb(23 23 20 / 10%); }
.bpmn-designer .djs-palette .entry { color: #45443f; }
.bpmn-designer .djs-palette .entry:hover { background: #d9ff43; color: #171714; }
.bpmn-designer .djs-container svg { font-family: 'DM Sans', sans-serif; }
.bpmn-designer .djs-label { fill: #171714 !important; font-size: 12px !important; font-weight: 600; }
.bpmn-designer .djs-connection .djs-visual > path { stroke: #66655e !important; stroke-width: 1.8px !important; }
.bpmn-designer .djs-element.safair-mode-manual .djs-visual > :first-child { fill: #fffef9 !important; stroke: #55544e !important; stroke-width: 2.4px !important; }
.bpmn-designer .djs-element.safair-mode-rule-automated .djs-visual > :first-child { fill: #e4f5ec !important; stroke: #0f7049 !important; stroke-width: 2.8px !important; }
.bpmn-designer .djs-element.safair-mode-ai-assisted .djs-visual > :first-child { fill: #eee9ff !important; stroke: #6544c2 !important; stroke-width: 2.8px !important; }
.bpmn-designer .djs-element.safair-mode-ai-autonomous .djs-visual > :first-child { fill: #e6edff !important; stroke: #354dcc !important; stroke-width: 3.2px !important; }
.bpmn-designer .djs-element.selected .djs-outline { stroke: #171714 !important; stroke-width: 2px !important; stroke-dasharray: 4 3; }
.bpmn-designer .bjs-powered-by { display: none; }
.safair-bpmn-state { height: 22px; display: inline-flex; align-items: stretch; overflow: hidden; border: 1px solid #fffef9; border-radius: 0; background: #55544e; color: #fff; box-shadow: 2px 2px 0 rgb(23 23 20 / 14%); font: 800 8px/1 'DM Sans', sans-serif; letter-spacing: .035em; text-transform: uppercase; white-space: nowrap; }
.safair-bpmn-state__mode { padding: 0 7px; display: inline-flex; align-items: center; }
.safair-bpmn-state--rule-automated { background: #0f7049; }
.safair-bpmn-state--ai-assisted { background: #6544c2; }
.safair-bpmn-state--ai-autonomous { background: #354dcc; }
.safair-bpmn-state__flag { min-width: 20px; display: grid; place-items: center; border-left: 1px solid rgb(255 255 255 / 48%); background: rgb(255 255 255 / 16%); font-size: 10px; }
.safair-bpmn-state__flag.is-potential { color: #d9ff43; }
.safair-bpmn-state__flag.is-approval { padding: 0 6px; background: #354dcc; color: #fff; font-size: 8px; }
.safair-bpmn-state__flag.is-risk { background: #b72f3f; color: #fff; }
</style>
