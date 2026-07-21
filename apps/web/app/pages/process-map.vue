<script setup lang="ts">
import type { ExecutionMode, LandscapeLayer, ProcessRelationType, ProcessStep, WorkflowNodeType, WorkflowPosition } from '~/composables/useProcessMap'
import { calculateProcessMetrics } from '~/composables/useProcessMap'
import { createBpmn, parseBpmn } from '~/utils/bpmn'
import { layoutBpmnXml } from '~/utils/bpmnLayout'
import { materializeAiDraft, type AiProcessDraft } from '~/utils/processDraft'

const route = useRoute()
const config = useRuntimeConfig()
const {
  processes,
  demoPreset,
  metrics,
  tools,
  toggleTool,
  addProcess,
  addWorkflowStep,
  addConnection,
  removeConnection,
  removeStep,
  updateStepPosition,
  addImportedProcesses,
  getBpmnDocument,
  setBpmnDocument,
  updateProcessesFromDocument,
  addProcessRelation,
  removeProcessRelation,
  resetProcesses,
  loadDemoPreset,
  markCustom
} = useProcessMap()

const queryProcess = typeof route.query.process === 'string' ? route.query.process : ''
const selectedProcessId = ref(processes.value.some((process) => process.id === queryProcess) ? queryProcess : processes.value[0]?.id ?? '')
const viewMode = ref<'landscape' | 'workflow'>(queryProcess ? 'workflow' : 'landscape')
const selectedStepId = ref('')
const selectedEdgeId = ref('')
const toolFilter = ref('Alle')
const processTour = ref<{ start: () => void }>()
const createOpen = ref(false)
const newProcessName = ref('')
const newProcessOwner = ref('')
const newProcessLayer = ref<LandscapeLayer>('core')
const newProcessDomain = ref('')
const bpmnInput = ref<HTMLInputElement>()
const bpmnDesigner = ref<any>()
const designerWorkspace = ref<HTMLElement>()
const designerFullscreen = ref(false)
const lastLayoutXml = ref('')
const processPickerName = ref('')
const transferNotice = ref<{ type: 'success' | 'error'; title: string; detail: string } | null>(null)
const relationOpen = ref(false)
const aiOpen = ref(false)
const aiDescription = ref('')
const aiCompanyContext = ref('')
const aiGenerating = ref(false)
const aiTranscribing = ref(false)
const aiRecording = ref(false)
const aiRecordingSeconds = ref(0)
const aiDraft = ref<AiProcessDraft>()
const aiMaterialized = ref<ReturnType<typeof materializeAiDraft>>()
const aiError = ref('')
const newRelationSource = ref('')
const newRelationTarget = ref('')
const newRelationType = ref<ProcessRelationType>('handoff')
const newRelationLabel = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
let processTourTimer: number | undefined
let mediaRecorder: MediaRecorder | undefined
let mediaStream: MediaStream | undefined
let recordingTimer: ReturnType<typeof setInterval> | undefined
let recordingChunks: Blob[] = []
let discardRecording = false

const PROCESS_TOUR_STORAGE_KEY = 'safair:process-onboarding-tour'
const processTourSteps = [
  {
    eyebrow: 'Prozess-Tour',
    title: 'Von der Unternehmenskarte bis zum nativen BPMN',
    description: 'Diese Tour zeigt Demo-Presets, große Prozesslandkarten, echte BPMN-Bearbeitung und die getrennten Kennzahlen für Automatisierung und KI.',
    target: '[data-process-tour="process-intro"]'
  },
  {
    eyebrow: '01 · Prozessportfolio',
    title: 'Original-BPMN ohne Geometrieverlust übernehmen',
    description: 'Importierte Pools, Lanes, Symboltypen, Größen, Positionen und Kanten-Wegpunkte bleiben als natives BPMN-Dokument erhalten. Im Einzelprozess exportierst du genau dieses Dokument wieder.',
    target: '[data-process-tour="process-actions"]'
  },
  {
    eyebrow: '02 · KI-Erstellung',
    title: 'Beschreiben, sprechen, prüfen',
    description: '„Mit KI erstellen“ akzeptiert Text oder eine maximal fünfminütige Sprachnotiz. Das editierbare Transkript wird in einen validierten BPMN-Entwurf mit Annahmen und Warnungen übersetzt und erst nach deiner Freigabe gespeichert.',
    target: '[data-process-tour="ai-create"]'
  },
  {
    eyebrow: '03 · Zwei Detailstufen',
    title: 'Landkarte und Workflow erfüllen unterschiedliche Aufgaben',
    description: 'Die Prozesslandschaft beantwortet „Welche Prozesse gibt es und wie hängen sie zusammen?“. Der Workflow-Designer zeigt dagegen den Ablauf innerhalb eines ausgewählten Prozesses.',
    target: '[data-process-tour="view-modes"]'
  },
  {
    eyebrow: '04 · Demo-Presets',
    title: 'Kompakt oder realistisch komplex',
    description: 'Die kompakte Demo eignet sich zum Einstieg. Die komplexe Demo lädt exakt 3 Steuerungs-, 10 Kern- und 20 Unterstützungsprozesse; eigene Daten werden nur nach Bestätigung ersetzt.',
    target: '[data-process-tour="demo-presets"]'
  },
  {
    eyebrow: '05 · Management-Kennzahlen',
    title: 'Kennzahlen nur dann öffnen, wenn du sie brauchst',
    description: 'Die kompakte Kennzahlenzeile fasst Prozesse, Automatisierung und KI zusammen und lässt sich aufklappen. Die Berechnung zählt nur echte BPMN-Aktivitäten; Events und Gateways verzerren den Nenner nicht.',
    target: '[data-process-tour="portfolio-kpis"]'
  },
  {
    eyebrow: '06 · Unternehmenskarte',
    title: 'Semantischer Zoom hält große Portfolios lesbar',
    description: 'Beim Herauszoomen verschwinden Prozesskarten automatisch: Bereiche und ihre Verbindungen bleiben als Orientierung sichtbar. Beim Hineinzoomen erscheinen die Prozesse wieder; Filter und Suche grenzen das Portfolio zusätzlich ein.',
    target: '[data-process-tour="landscape-map"]'
  },
  {
    eyebrow: '07 · Landkarten-Besen',
    title: 'Verbindungen filtern oder die Karte aufräumen',
    description: 'Pfeile lassen sich ein- und ausblenden oder nach Übergabeart filtern. Der Besen sortiert Ebenen, Domänen und Prozesse deterministisch und setzt den sichtbaren Ausschnitt zurück.',
    target: '[data-process-tour="relations"]'
  },
  {
    eyebrow: '08 · Prozessstammdaten',
    title: 'Owner, Abteilung und Ebene schaffen Verantwortung',
    description: 'Im Einzelprozess werden fachliche Verantwortung, Status und organisatorische Einordnung gepflegt. Die Kennzahlen rechts zeigen die daraus berechnete Governance-Situation.',
    target: '[data-process-tour="process-hero"]'
  },
  {
    eyebrow: '09 · Native BPMN-Bearbeitung',
    title: 'BPMN-Semantik mit klarer Ausführungsart',
    description: 'Tasks, Events, Gateways, Subprozesse, Pools und Lanes bleiben natives BPMN 2.0. Farbe, Text-Badge und die Ablaufübersicht unterscheiden manuell, technisch automatisiert, KI-assistiert und KI-autonom.',
    target: '[data-process-tour="workflow-builder"]'
  },
  {
    eyebrow: '10 · Besen und Vollbild',
    title: 'Zwei klare Werkzeug-Icons für die Arbeitsfläche',
    description: 'Besen und Vollbild sind als kompakte Icons mit Tooltip verfügbar. Der Besen ordnet Flüsse links nach rechts; im Vollbild bleiben nur Designer, Ablaufübersicht und der Inspector des gewählten Schritts.',
    target: '[data-process-tour="designer-tools"]'
  },
  {
    eyebrow: '11 · Automatisierung und Governance',
    title: 'Technische Ausführung ist nicht automatisch KI',
    description: 'Pro Aktivität pflegst du manuell, regelbasiert automatisiert, KI-assistiert oder KI-autonom. Die Zuordnung eines echten KI-Modells setzt einen manuellen Schritt automatisch auf KI-assistiert; Human-in-the-Loop erscheint direkt als blauer Info-Tag.',
    target: '[data-process-tour="step-detail"]'
  },
  {
    eyebrow: '12 · KI-Werkzeuge',
    title: 'KI- und Safety-Tools gezielt zuweisen',
    description: 'Modelle und Governance-Werkzeuge werden der konkreten Aktivität zugeordnet. PII-, Safety- und Testing-Werkzeuge verbessern die Kontrolle, verändern aber den technisch erfassten KI-Anteil nicht.',
    target: '[data-process-tour="tool-assignment"]'
  },
  {
    eyebrow: '13 · Governance-Nachweis',
    title: 'Die Verantwortungsmatrix fasst den Workflow zusammen',
    description: 'Zum Abschluss entsteht automatisch eine prüfbare Übersicht aus Prozessschritt, Verantwortlichem, Kontrolle und Freigabe. Die Prozess-Tour kann oben jederzeit erneut gestartet werden.',
    target: '[data-process-tour="responsibility"]'
  }
]

const selectedProcess = computed(() => processes.value.find((process) => process.id === selectedProcessId.value))
const selectedStep = computed(() => selectedProcess.value?.steps.find((step) => step.id === selectedStepId.value))
const selectedEdge = computed(() => selectedProcess.value?.connections.find((edge) => edge.id === selectedEdgeId.value))
const selectedMetrics = computed(() => selectedProcess.value ? calculateProcessMetrics([selectedProcess.value]) : calculateProcessMetrics([]))
const selectedDocument = computed(() => getBpmnDocument(selectedProcess.value))
const selectedBpmnXml = computed(() => {
  if (!selectedProcess.value) return ''
  return selectedDocument.value?.xml || createBpmn([selectedProcess.value])
})
const categories = computed(() => ['Alle', ...new Set(tools.map((tool) => tool.category))])
const filteredTools = computed(() => toolFilter.value === 'Alle' ? tools : tools.filter((tool) => tool.category === toolFilter.value))

const executionModeMeta: Record<ExecutionMode, { label: string; shortLabel: string }> = {
  manual: { label: 'Manuell', shortLabel: 'MAN' },
  rule_automated: { label: 'Technisch automatisiert', shortLabel: 'AUT' },
  ai_assisted: { label: 'KI-assistiert', shortLabel: 'KI+' },
  ai_autonomous: { label: 'KI-autonom', shortLabel: 'KI AUTO' }
}

function isActivityStep(step: ProcessStep) {
  return /(?:Task|SubProcess|CallActivity)$/.test(step.bpmnElementType)
}

const designerActivities = computed(() => selectedProcess.value?.steps.filter(isActivityStep) ?? [])
const designerExecutionCounts = computed(() => designerActivities.value.reduce<Record<ExecutionMode, number>>((counts, step) => {
  counts[step.executionMode] += 1
  return counts
}, { manual: 0, rule_automated: 0, ai_assisted: 0, ai_autonomous: 0 }))

function activityTypeLabel(step: ProcessStep) {
  return step.bpmnElementType.replace('bpmn:', '').replace(/([a-z])([A-Z])/g, '$1 $2')
}

function openDesignerStep(id: string) {
  selectStep(id)
  nextTick(() => {
    bpmnDesigner.value?.selectElement(id)
    if (designerFullscreen.value) window.setTimeout(() => bpmnDesigner.value?.fitView(), 180)
  })
}

const selectedCoverage = computed(() => selectedMetrics.value.aiShare)

const selectedToolCount = computed(() => new Set(selectedProcess.value?.steps.flatMap((step) => step.toolIds) ?? []).size)
const selectedHighRisks = computed(() => selectedProcess.value?.steps.filter((step) => step.risk === 'high').length ?? 0)
const selectedHumanControls = computed(() => selectedProcess.value?.steps.filter((step) => step.humanApproval).length ?? 0)

watch(selectedProcess, (process) => {
  selectedStepId.value = ''
  selectedEdgeId.value = ''
  processPickerName.value = process?.name ?? ''
}, { immediate: true })

let governanceTimer: ReturnType<typeof setTimeout> | undefined
watch(selectedStep, (step) => {
  if (!step) return
  markCustom()
  clearTimeout(governanceTimer)
  governanceTimer = setTimeout(() => bpmnDesigner.value?.updateGovernance(step), 180)
}, { deep: true })

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
    const importedIds = addImportedProcesses(result.processes, result.document)
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
    const xml = exportedProcesses.length === 1 && selectedDocument.value
      ? selectedDocument.value.xml
      : createBpmn(exportedProcesses)
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

function handleBpmnSelection(id: string) {
  if (!selectedProcess.value?.steps.some((step) => step.id === id)) return
  selectStep(id)
}

function handleBpmnChange(xml: string) {
  if (!selectedProcess.value) return
  const document = setBpmnDocument(selectedProcess.value, xml)
  try {
    const parsed = parseBpmn(xml)
    updateProcessesFromDocument(document.id, parsed.processes)
  } catch (error) {
    showNotice('error', 'BPMN konnte nicht synchronisiert werden', error instanceof Error ? error.message : 'Bitte prüfe das Diagramm.')
  }
}

async function tidyProcess() {
  if (!selectedProcess.value) return
  try {
    const current = await bpmnDesigner.value?.currentXml() || selectedBpmnXml.value
    lastLayoutXml.value = current
    const arranged = await layoutBpmnXml(current)
    await bpmnDesigner.value?.importXml(arranged)
    handleBpmnChange(arranged)
    showNotice('success', 'Prozess aufgeräumt', 'Der BPMN-Fluss wurde links nach rechts geordnet. Über „Rückgängig“ kannst du die Originalgeometrie wiederherstellen.')
  } catch (error) {
    showNotice('error', 'Aufräumen fehlgeschlagen', error instanceof Error ? error.message : 'Das Diagramm konnte nicht angeordnet werden.')
  }
}

async function undoTidyProcess() {
  if (!lastLayoutXml.value) return
  const xml = lastLayoutXml.value
  lastLayoutXml.value = ''
  await bpmnDesigner.value?.importXml(xml)
  handleBpmnChange(xml)
  showNotice('success', 'Originalgeometrie wiederhergestellt', 'Pools, Lanes, Positionen und Kanten-Wegpunkte entsprechen wieder dem Stand vor dem Aufräumen.')
}

async function toggleDesignerFullscreen() {
  if (!designerWorkspace.value) return
  if (document.fullscreenElement) await document.exitFullscreen()
  else await designerWorkspace.value.requestFullscreen()
}

function syncFullscreenState() {
  designerFullscreen.value = document.fullscreenElement === designerWorkspace.value
  requestAnimationFrame(() => bpmnDesigner.value?.fitView())
}

function chooseProcessByName() {
  const process = processes.value.find((item) => item.name === processPickerName.value)
  if (process) selectProcess(process.id)
}

function changeDemoPreset(event: Event) {
  const value = (event.target as HTMLSelectElement).value as 'compact' | 'complex'
  ;(event.target as HTMLSelectElement).value = demoPreset.value === 'custom' ? '' : demoPreset.value
  if ((demoPreset.value === 'custom' || processes.value.length) && !confirm(`Aktuelle Prozessdaten ersetzen und die ${value === 'complex' ? 'komplexe' : 'kompakte'} Demo laden?`)) return
  loadDemoPreset(value)
  selectedProcessId.value = processes.value[0]?.id ?? ''
  viewMode.value = 'landscape'
}

function apiErrorMessage(payload: any, fallback: string) {
  return payload?.detail?.error?.message || payload?.error?.message || payload?.message || fallback
}

function openAiGenerator() {
  aiError.value = ''
  aiDraft.value = undefined
  aiMaterialized.value = undefined
  aiOpen.value = true
}

function releaseRecording() {
  if (recordingTimer) clearInterval(recordingTimer)
  recordingTimer = undefined
  mediaStream?.getTracks().forEach((track) => track.stop())
  mediaStream = undefined
  mediaRecorder = undefined
  aiRecording.value = false
}

async function transcribeRecording(blob: Blob) {
  if (!blob.size || discardRecording) return
  if (blob.size > 20 * 1024 * 1024) {
    aiError.value = 'Die Sprachnotiz ist größer als 20 MB. Bitte nimm eine kürzere Notiz auf.'
    return
  }
  aiTranscribing.value = true
  aiError.value = ''
  try {
    const form = new FormData()
    const extension = blob.type.includes('mp4') ? 'mp4' : 'webm'
    form.append('audio', blob, `prozess-sprachnotiz.${extension}`)
    const response = await fetch(`${config.public.apiBase}/api/orchestrator/v1/audio/transcriptions`, {
      method: 'POST', credentials: 'include', body: form
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(apiErrorMessage(payload, 'Die Sprachnotiz konnte nicht transkribiert werden.'))
    const transcript = String(payload.text || '').trim()
    aiDescription.value = aiDescription.value.trim() ? `${aiDescription.value.trim()}\n\n${transcript}` : transcript
  } catch (error) {
    aiError.value = error instanceof Error ? error.message : 'Die Sprachnotiz konnte nicht transkribiert werden.'
  } finally {
    aiTranscribing.value = false
    recordingChunks = []
  }
}

async function startRecording() {
  aiError.value = ''
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    aiError.value = 'Sprachaufnahme wird von diesem Browser nicht unterstützt.'
    return
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
    mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined)
    recordingChunks = []
    discardRecording = false
    aiRecordingSeconds.value = 0
    mediaRecorder.ondataavailable = (event) => { if (event.data.size) recordingChunks.push(event.data) }
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordingChunks, { type: mediaRecorder?.mimeType || mimeType || 'audio/webm' })
      releaseRecording()
      void transcribeRecording(blob)
    }
    mediaRecorder.start(1000)
    aiRecording.value = true
    recordingTimer = setInterval(() => {
      aiRecordingSeconds.value += 1
      if (aiRecordingSeconds.value >= 300) stopRecording()
    }, 1000)
  } catch (error) {
    releaseRecording()
    aiError.value = error instanceof DOMException && error.name === 'NotAllowedError'
      ? 'Mikrofonzugriff wurde abgelehnt. Du kannst die Prozessbeschreibung weiterhin eintippen.'
      : 'Die Sprachaufnahme konnte nicht gestartet werden.'
  }
}

function stopRecording() {
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop()
}

function cancelRecording() {
  discardRecording = true
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop()
  else releaseRecording()
  recordingChunks = []
}

function closeAiGenerator() {
  if (aiRecording.value) cancelRecording()
  aiOpen.value = false
}

async function generateAiProcess() {
  if (aiDescription.value.trim().length < 20) return
  aiGenerating.value = true
  aiError.value = ''
  aiDraft.value = undefined
  aiMaterialized.value = undefined
  try {
    const response = await fetch(`${config.public.apiBase}/api/orchestrator/v1/processes/generate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: aiDescription.value.trim(), company_context: aiCompanyContext.value.trim() || null })
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(apiErrorMessage(payload, 'Der KI-Entwurf konnte nicht erzeugt werden.'))
    aiDraft.value = payload as AiProcessDraft
    aiMaterialized.value = materializeAiDraft(aiDraft.value)
  } catch (error) {
    aiError.value = error instanceof Error ? error.message : 'Der KI-Entwurf konnte nicht erzeugt werden.'
  } finally {
    aiGenerating.value = false
  }
}

function acceptAiDraft() {
  if (!aiMaterialized.value) return
  const ids = addImportedProcesses([aiMaterialized.value.process], aiMaterialized.value.document)
  selectedProcessId.value = ids[0] ?? selectedProcessId.value
  viewMode.value = 'workflow'
  closeAiGenerator()
  showNotice('success', 'KI-Entwurf übernommen', 'Der Prozess wurde als natives BPMN-Dokument angelegt und kann jetzt fachlich geprüft und bearbeitet werden.')
}

function recordingTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
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

function prepareProcessTourStep(index: number) {
  createOpen.value = false
  relationOpen.value = false
  closeAiGenerator()
  const target = processTourSteps[index]?.target ?? ''
  const workflowTarget = ['process-hero', 'workflow-builder', 'designer-tools', 'step-detail', 'tool-assignment', 'responsibility']
    .some((name) => target.includes(name))

  if (!workflowTarget) {
    viewMode.value = 'landscape'
    selectedStepId.value = ''
    selectedEdgeId.value = ''
    return
  }

  viewMode.value = 'workflow'
  if (!selectedProcess.value) selectedProcessId.value = processes.value[0]?.id ?? ''

  if (target.includes('step-detail') || target.includes('tool-assignment') || target.includes('responsibility')) {
    selectedStepId.value = selectedProcess.value?.steps[0]?.id ?? ''
    selectedEdgeId.value = ''
  } else {
    selectedStepId.value = ''
    selectedEdgeId.value = ''
  }
}

const statusLabel = (status: string) => status === 'active' ? 'Produktiv' : status === 'pilot' ? 'Pilot' : 'Geplant'
onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenState)
  processTourTimer = window.setTimeout(() => {
    try {
      const generalState = JSON.parse(localStorage.getItem('safair:onboarding-tour') || 'null') as { version?: number; status?: string } | null
      const generalTourSeen = generalState?.version === 2 && (generalState.status === 'completed' || generalState.status === 'skipped')
      const processState = JSON.parse(localStorage.getItem(PROCESS_TOUR_STORAGE_KEY) || 'null') as { version?: number; status?: string } | null
      const processTourSeen = processState?.version === 5 && (processState.status === 'completed' || processState.status === 'skipped')
      if (generalTourSeen && !processTourSeen && !document.querySelector('.tour')) processTour.value?.start()
    } catch {
      // The contextual tour remains available through its button when storage is blocked.
    }
  }, 950)
})
onBeforeUnmount(() => {
  if (noticeTimer) clearTimeout(noticeTimer)
  if (processTourTimer) clearTimeout(processTourTimer)
  if (governanceTimer) clearTimeout(governanceTimer)
  document.removeEventListener('fullscreenchange', syncFullscreenState)
  if (aiRecording.value) cancelRecording()
  else releaseRecording()
})
</script>

<template>
  <div class="process-page">
    <header class="page-head" data-process-tour="process-intro">
      <div>
        <p class="page-kicker">Business Process Intelligence</p>
        <h1>Prozesslandkarte</h1>
        <p class="page-description">Das gesamte Prozessportfolio steuern, in Workflows einsteigen und KI-Tools direkt den einzelnen Prozessschritten zuweisen.</p>
      </div>
      <div class="page-actions" data-process-tour="process-actions">
        <button class="button-secondary process-tour-button" @click="processTour?.start()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 0 1 4.8 1c0 2-2.5 2.1-2.5 4M12 18h.01"/></svg>
          Prozess-Tour
        </button>
        <button class="button-secondary" @click="triggerBpmnImport">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
          BPMN importieren
        </button>
        <button class="button-secondary" @click="exportBpmnFile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 21h14"/></svg>
          BPMN exportieren
        </button>
        <button class="ai-create-button" data-process-tour="ai-create" @click="openAiGenerator">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18 12h3M16.3 7.7l2.1-2.1"/><rect x="7" y="8" width="10" height="11" rx="3"/><path d="M10 13h.01M14 13h.01M10 16h4"/></svg>
          Mit KI erstellen
        </button>
        <button @click="openNewProcess">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Prozess hinzufügen
        </button>
        <input ref="bpmnInput" class="file-input" type="file" accept=".bpmn,.xml,application/xml,text/xml" @change="handleBpmnImport" />
      </div>
    </header>

    <section class="process-viewbar card">
      <div class="view-tabs" data-process-tour="view-modes">
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
      <div class="demo-controls">
        <label class="demo-picker" data-process-tour="demo-presets">
          <span>Demo · {{ demoPreset === 'complex' ? 'Komplex' : demoPreset === 'compact' ? 'Kompakt' : 'angepasst' }}</span>
          <select :value="demoPreset === 'custom' ? '' : demoPreset" @change="changeDemoPreset">
            <option disabled value="">Demo wählen …</option>
            <option value="compact">Kompakte Demo laden</option>
            <option value="complex">Komplexe Demo laden</option>
          </select>
        </label>
        <button class="reset-link" @click="restoreDemo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
          Kompakte Demo
        </button>
      </div>
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
      <div v-if="processes.length <= 12" class="process-tabs">
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
      <label v-else class="process-search-picker">
        <span>Prozess suchen</span>
        <input v-model="processPickerName" list="process-picker-options" placeholder="Name oder Bereich" @change="chooseProcessByName" />
        <datalist id="process-picker-options">
          <option v-for="process in processes" :key="process.id" :value="process.name">{{ process.domain }}</option>
        </datalist>
      </label>
      <select v-model="selectedProcessId" class="process-select" aria-label="Prozess auswählen">
        <option v-for="process in processes" :key="process.id" :value="process.id">{{ process.name }}</option>
      </select>
    </section>

    <template v-if="viewMode === 'workflow' && selectedProcess">
      <section class="process-hero" data-process-tour="process-hero">
        <div class="process-heading">
          <div class="process-symbol">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h10M4 18h16"/><circle cx="17" cy="12" r="3"/></svg>
          </div>
          <div>
            <div class="process-name-line">
              <h2>{{ selectedProcess.name }}</h2>
              <select v-model="selectedProcess.status" class="status-select" :class="`status-select--${selectedProcess.status}`" @change="markCustom">
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
                <input v-model="selectedProcess.domain" placeholder="z. B. Customer Operations" @change="markCustom" />
              </label>
              <label>
                <span>Prozessebene</span>
                <select v-model="selectedProcess.landscapeLayer" @change="markCustom">
                  <option value="management">Steuerungsprozess</option>
                  <option value="core">Kernprozess</option>
                  <option value="support">Unterstützungsprozess</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div class="process-metrics">
          <div><strong>{{ selectedMetrics.automationRate }}%</strong><span>Automatisierung</span></div>
          <div><strong>{{ selectedMetrics.aiShare }}%</strong><span>KI-Anteil</span></div>
          <div><strong>{{ selectedMetrics.automationPotential }}%</strong><span>Potenzial</span></div>
          <div><strong>{{ selectedToolCount }}</strong><span>Tool-Abdeckung</span></div>
          <div><strong>{{ selectedHighRisks }}</strong><span>Hohe Risiken</span></div>
          <div><strong>{{ selectedMetrics.humanOversight }}%</strong><span>Human Oversight</span></div>
        </div>
      </section>

      <section ref="designerWorkspace" class="map-layout designer-workspace" :class="{ 'map-layout--detail': selectedStep || selectedEdge, 'is-fullscreen': designerFullscreen }">
        <div class="map-column">
          <article class="card map-card" data-process-tour="workflow-builder">
            <div class="map-head">
              <div>
                <p class="section-kicker">Visueller Prozessaufbau</p>
                <h2>Workflow-Designer</h2>
              </div>
              <div class="designer-actions" data-process-tour="designer-tools">
                <span class="map-legend" aria-label="Ausführungsarten im Prozess">
                  <span class="mode-legend mode-legend--manual"><i /><span class="mode-long">Manuell</span><span class="mode-short">MAN</span><b>{{ designerExecutionCounts.manual }}</b></span>
                  <span class="mode-legend mode-legend--automation"><i /><span class="mode-long">Technisch automatisiert</span><span class="mode-short">AUT</span><b>{{ designerExecutionCounts.rule_automated }}</b></span>
                  <span class="mode-legend mode-legend--ai-assisted"><i /><span class="mode-long">KI-assistiert</span><span class="mode-short">KI+</span><b>{{ designerExecutionCounts.ai_assisted }}</b></span>
                  <span class="mode-legend mode-legend--ai-autonomous"><i /><span class="mode-long">KI-autonom</span><span class="mode-short">KI AUTO</span><b>{{ designerExecutionCounts.ai_autonomous }}</b></span>
                </span>
                <div class="designer-tool-buttons" aria-label="Designer-Werkzeuge">
                  <button class="button-secondary designer-icon-button" aria-label="BPMN aufräumen" title="BPMN automatisch anordnen" @click="tidyProcess">
                    <span class="broom-icon" aria-hidden="true">🧹</span>
                  </button>
                  <button class="button-secondary designer-icon-button" :aria-label="designerFullscreen ? 'Vollbild beenden' : 'Designer im Vollbild öffnen'" :title="designerFullscreen ? 'Vollbild beenden (Esc)' : 'Designer im Vollbild öffnen'" @click="toggleDesignerFullscreen">
                    <svg v-if="!designerFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <div class="designer-step-strip" aria-label="Ablaufübersicht und Schrittauswahl">
              <div class="step-strip-intro">
                <strong>Ablaufübersicht</strong>
                <span>{{ designerActivities.length }} Aktivitäten · Schritt wählen zum Bearbeiten</span>
              </div>
              <div class="step-strip-list">
                <button
                  v-for="(step, index) in designerActivities"
                  :key="step.id"
                  :class="[`step-strip-item--${step.executionMode.replace('_', '-')}`, { active: selectedStepId === step.id, 'has-human': step.humanApproval }]"
                  :title="`${executionModeMeta[step.executionMode].label}: ${step.title}`"
                  @click="openDesignerStep(step.id)"
                >
                  <i />
                  <span>
                    <small>{{ String(index + 1).padStart(2, '0') }} · {{ activityTypeLabel(step) }}</small>
                    <strong>{{ step.title }}</strong>
                  </span>
                  <em>{{ executionModeMeta[step.executionMode].shortLabel }}</em>
                  <em v-if="step.executionMode === 'manual' && step.automationPotential !== 'none'" class="potential-flag" :title="step.automationPotential === 'full' ? 'Voll automatisierbar' : 'Teilweise automatisierbar'">↗</em>
                  <em v-if="step.humanApproval" class="human-flag" title="Manuelle Freigabe erforderlich">✓ Human</em>
                </button>
              </div>
            </div>

            <ClientOnly>
              <BpmnDesigner
                ref="bpmnDesigner"
                :xml="selectedBpmnXml"
                :selected-element-id="selectedStepId"
                :governance-steps="selectedProcess.steps"
                @selected="handleBpmnSelection"
                @changed="handleBpmnChange"
                @error="showNotice('error', 'BPMN-Designer', $event)"
              />
              <template #fallback><div class="canvas-loading">Workflow-Designer wird geladen …</div></template>
            </ClientOnly>

            <div class="map-insight">
              <span class="insight-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
              </span>
              <div><strong>Management-Hinweis</strong><p>{{ selectedMetrics.automationRate }}% der echten BPMN-Aktivitäten laufen technisch automatisiert, davon betreffen {{ selectedMetrics.aiShare }}% KI. Das zusätzliche Automatisierungspotenzial manueller Aktivitäten liegt bei {{ selectedMetrics.automationPotential }}%.</p></div>
            </div>
          </article>

        </div>

        <aside v-if="selectedStep || selectedEdge" class="card detail-panel" data-process-tour="step-detail">
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
            <label class="field"><span>BPMN-Element</span>
              <input :value="selectedStep.bpmnElementType.replace('bpmn:', '')" disabled />
            </label>
            <label class="field"><span>Risikostufe</span>
              <select v-model="selectedStep.risk"><option value="low">Niedrig</option><option value="medium">Mittel</option><option value="high">Hoch</option></select>
            </label>
            <label class="field execution-field" :class="`execution-field--${selectedStep.executionMode.replace('_', '-')}`"><span>Aktuelle Ausführung</span>
              <select v-model="selectedStep.executionMode">
                <option value="manual">Manuell</option>
                <option value="rule_automated">Regelbasiert automatisiert</option>
                <option value="ai_assisted">KI-assistiert</option>
                <option value="ai_autonomous">KI-autonom</option>
              </select>
            </label>
            <label class="field"><span>Automatisierungspotenzial</span>
              <select v-model="selectedStep.automationPotential">
                <option value="none">Kein Potenzial</option>
                <option value="partial">Teilweise automatisierbar</option>
                <option value="full">Voll automatisierbar</option>
              </select>
            </label>
            <label class="field field--full"><span>Bezeichnung</span><input v-model="selectedStep.title" /></label>
            <label class="field field--full"><span>Beschreibung</span><textarea v-model="selectedStep.description" rows="3" /></label>
            <label class="field"><span>Verantwortlich</span><input v-model="selectedStep.owner" /></label>
            <label class="field"><span>Bereich</span><input v-model="selectedStep.department" /></label>
            <label class="toggle-field">
              <span><strong>Human-in-the-Loop <em v-if="selectedStep.humanApproval" class="active-info-tag">Aktiv</em></strong><small>Manuelle Prüfung erforderlich</small></span>
              <input v-model="selectedStep.humanApproval" type="checkbox" />
              <i />
            </label>
            <label class="field field--full"><span>Kontrollmaßnahme</span><textarea v-model="selectedStep.control" rows="2" /></label>
          </div>

          <div class="tool-assignment" data-process-tour="tool-assignment">
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

      <article class="card responsibility-card" data-process-tour="responsibility">
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

    <div v-if="aiOpen" class="modal-backdrop ai-modal-backdrop" @click.self="closeAiGenerator">
      <section class="create-modal ai-process-modal" data-process-tour="ai-generator">
        <header class="ai-modal-head">
          <div>
            <p class="section-kicker">KI-Prozessassistent</p>
            <h2>Aus Beschreibung einen BPMN-Entwurf bauen</h2>
            <span>Text und Audio werden erst mit deiner Aktion an den konfigurierten Provider übertragen. Audio wird nicht gespeichert.</span>
          </div>
          <button class="delete-icon" aria-label="Dialog schließen" @click="closeAiGenerator">×</button>
        </header>

        <div class="ai-modal-grid" :class="{ 'has-preview': aiMaterialized }">
          <div class="ai-prompt-column">
            <label class="field"><span>Prozessbeschreibung</span>
              <textarea v-model="aiDescription" rows="9" placeholder="Beschreibe Auslöser, Beteiligte, Arbeitsschritte, Entscheidungen, Systeme, Risiken und gewünschtes Ergebnis …" />
            </label>
            <div class="speech-controls">
              <button v-if="!aiRecording" class="button-secondary" :disabled="aiTranscribing" @click="startRecording">🎙 Sprachnotiz aufnehmen</button>
              <template v-else>
                <span class="recording-state"><i /> Aufnahme {{ recordingTime(aiRecordingSeconds) }} / 05:00</span>
                <button @click="stopRecording">Aufnahme verwenden</button>
                <button class="button-secondary" @click="cancelRecording">Verwerfen</button>
              </template>
              <span v-if="aiTranscribing" class="transcribing-state">Transkript wird erstellt …</span>
            </div>
            <label class="field"><span>Unternehmenskontext (optional)</span>
              <textarea v-model="aiCompanyContext" rows="4" placeholder="Branche, Organisationsbereiche, Richtlinien oder eingesetzte Systeme" />
            </label>
            <p v-if="aiError" class="ai-error">{{ aiError }}</p>
            <button class="ai-generate" :disabled="aiDescription.trim().length < 20 || aiGenerating || aiRecording || aiTranscribing" @click="generateAiProcess">
              {{ aiGenerating ? 'Entwurf wird validiert …' : 'BPMN-Entwurf generieren' }}
            </button>
          </div>

          <div v-if="aiMaterialized && aiDraft" class="ai-preview-column">
            <div class="ai-preview-head">
              <div><span>Prüfbarer Entwurf</span><strong>{{ aiDraft.name }}</strong></div>
              <span>{{ aiDraft.activities.length }} Elemente · {{ aiDraft.lanes.length }} Lanes</span>
            </div>
            <div class="ai-bpmn-preview">
              <ClientOnly><BpmnDesigner :xml="aiMaterialized.document.xml" readonly /></ClientOnly>
            </div>
            <div v-if="aiDraft.assumptions.length || aiDraft.warnings.length" class="draft-notes">
              <div v-if="aiDraft.assumptions.length"><strong>Annahmen</strong><ul><li v-for="item in aiDraft.assumptions" :key="item">{{ item }}</li></ul></div>
              <div v-if="aiDraft.warnings.length" class="draft-warnings"><strong>Warnungen</strong><ul><li v-for="item in aiDraft.warnings" :key="item">{{ item }}</li></ul></div>
            </div>
            <div class="modal-actions ai-preview-actions">
              <button class="button-secondary" @click="aiDraft = undefined; aiMaterialized = undefined">Entwurf verwerfen</button>
              <button @click="acceptAiDraft">Entwurf übernehmen</button>
            </div>
          </div>
        </div>
      </section>
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
        <button v-if="lastLayoutXml" class="notice-undo" @click="undoTidyProcess">Rückgängig</button>
        <button aria-label="Hinweis schließen" @click="transferNotice = null">×</button>
      </div>
    </Transition>

    <OnboardingTour
      ref="processTour"
      :steps="processTourSteps"
      :storage-key="PROCESS_TOUR_STORAGE_KEY"
      :auto-start="false"
      :version="5"
      :step-delay="320"
      @step-change="prepareProcessTourStep"
    />
  </div>
</template>

<style scoped>
.process-page { min-width: 0; container-type: inline-size; }
.page-head > div:first-child { flex: 1 1 430px; }
.page-actions { min-width: 0; flex: 0 1 790px; display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }
.page-actions button { flex: 0 0 auto; white-space: nowrap; }
.page-actions svg { width: 15px; }
.process-tour-button { border-style: dashed; }
.file-input { display: none; }
.process-viewbar { min-height: 58px; margin-bottom: 20px; padding: 7px 9px; display: flex; align-items: center; gap: 15px; }
.view-tabs { display: flex; padding: 3px; gap: 3px; border-radius: 9px; background: #f0f3f7; }.view-tabs button { min-height: 36px; padding: 0 13px; border-color: transparent; background: transparent; color: var(--muted); font-size: 9px; }.view-tabs button:hover { border-color: transparent; background: rgba(255,255,255,.65); color: var(--text); transform: none; }.view-tabs button.active { border-color: #dbe3ee; background: #fff; color: var(--accent); box-shadow: 0 2px 7px rgba(20,34,56,.07); }.view-tabs button:disabled { opacity: .45; }.view-tabs svg { width: 14px; }
.view-context { min-width: 0; display: flex; flex-direction: column; color: var(--muted-light); font-size: 7.5px; }.view-context strong { margin-bottom: 2px; overflow: hidden; color: var(--text); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.demo-controls { min-width: 0; margin-left: auto; display: flex; align-items: center; gap: 8px; }
.reset-link { min-height: 33px; padding: 0 9px; border-color: transparent; background: transparent; color: var(--muted); font-size: 8px; white-space: nowrap; }.reset-link:hover { border-color: transparent; background: var(--surface-soft); color: var(--text); transform: none; }.reset-link svg { width: 12px; }
.demo-picker { min-width: 0; display: flex; align-items: center; gap: 7px; color: var(--muted); font-size: 10px; white-space: nowrap; }.demo-picker select { min-height: 34px; font-size: 10px; }
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
.process-search-picker { min-width: min(420px, 55vw); display: flex; align-items: center; gap: 10px; }.process-search-picker span { color: var(--muted); font-size: 10px; white-space: nowrap; }.process-search-picker input { width: 100%; min-height: 42px; font-size: 11px; }

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
.designer-workspace:fullscreen { padding: 16px; grid-template-columns: minmax(0, 1fr); background: var(--paper); overflow: hidden; }.designer-workspace:fullscreen.map-layout--detail { grid-template-columns: minmax(0, 1fr) minmax(340px, 390px); }.designer-workspace:fullscreen .map-column { height: calc(100vh - 32px); grid-template-rows: minmax(0, 1fr); overflow: hidden; }.designer-workspace:fullscreen .map-card { min-height: 0; height: calc(100vh - 32px); display: flex; flex-direction: column; }.designer-workspace:fullscreen :deep(.bpmn-designer) { min-height: 0; flex: 1; }.designer-workspace:fullscreen .detail-panel { top: 0; max-height: calc(100vh - 32px); overflow-y: auto; }.designer-workspace:fullscreen .map-insight { display: none; }.designer-workspace:fullscreen .map-head { min-height: 58px; padding: 9px 12px; }.designer-workspace:fullscreen .map-head > div:first-child { display: none; }.designer-workspace:fullscreen .designer-actions { width: 100%; justify-content: space-between; flex-wrap: nowrap; }.designer-workspace:fullscreen .mode-long { display: none; }.designer-workspace:fullscreen .mode-short { display: inline; }.designer-workspace:fullscreen .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.designer-workspace:fullscreen .field--full { grid-column: 1 / -1; }.designer-workspace:fullscreen .tool-list { grid-template-columns: 1fr; }
.map-column { min-width: 0; display: grid; gap: 20px; }
.map-card { min-width: 0; padding: 0; overflow: hidden; }
.map-head { min-height: 67px; padding: 17px 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); }
.section-kicker { margin: 0; color: var(--muted-light); font-size: 8.5px; font-weight: 700; letter-spacing: .9px; text-transform: uppercase; }
.map-head h2 { margin: 3px 0 0; font-size: 15px; }
.designer-actions { min-width: 0; display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }.designer-actions button { min-height: 34px; padding: 0 10px; font-size: 10px; }
.designer-tool-buttons { padding-left: 10px; display: flex; align-items: center; gap: 5px; border-left: 1px solid var(--border-strong); }.designer-actions .designer-icon-button { width: 40px; min-width: 40px; min-height: 40px; padding: 0; }.designer-icon-button svg { width: 17px; }.designer-icon-button .broom-icon { font-size: 16px; line-height: 1; }
.map-legend { padding: 3px; display: flex; align-items: center; flex-wrap: wrap; gap: 0; border: 1px solid var(--border-strong); background: var(--surface); color: var(--muted); font-size: 8.5px; font-weight: 600; }
.mode-legend { min-height: 29px; padding: 0 8px; display: inline-flex; align-items: center; gap: 5px; border: 0; border-left: 1px solid var(--border); background: transparent; white-space: nowrap; }.mode-legend:first-child { border-left: 0; }.mode-legend i { width: 8px; height: 8px; background: #55544e; }.mode-legend b { min-width: 15px; color: var(--text); text-align: right; }.mode-legend--automation i { background: #0f7049; }.mode-legend--ai-assisted i { background: #6544c2; }.mode-legend--ai-autonomous i { background: #354dcc; }.mode-short { display: none; }
.node-dot { width: 7px; height: 7px; display: inline-block; margin-right: 4px; border-radius: 2px; }.node-dot--ai { background: var(--purple); }.node-dot--automation { margin-left: 7px; background: var(--ok); }.node-dot--decision { background: var(--warn); transform: rotate(45deg); }.node-dot--approval { background: var(--accent); }
.designer-step-strip { min-height: 86px; padding: 10px 12px; display: flex; align-items: stretch; gap: 12px; border-bottom: 1px solid var(--border-strong); background: #dcd9d0; }.step-strip-intro { width: 138px; flex: 0 0 auto; display: flex; justify-content: center; flex-direction: column; }.step-strip-intro strong { font-size: 11px; }.step-strip-intro span { margin-top: 3px; color: #55544e; font-size: 8.5px; line-height: 1.35; }.step-strip-list { min-width: 0; padding: 1px 2px 5px; display: flex; align-items: stretch; gap: 7px; overflow-x: auto; }.step-strip-list button { width: 192px; min-height: 62px; padding: 8px 8px 7px; position: relative; flex: 0 0 auto; display: grid; grid-template-columns: 4px minmax(0, 1fr) auto; align-items: center; gap: 8px; border: 1px solid #8f8d86; border-radius: 0; background: #fffef9; color: var(--text); text-align: left; box-shadow: 2px 2px 0 rgb(23 23 20 / 7%); }.step-strip-list button:hover { border-color: var(--ink); background: #fffef9; color: var(--text); transform: translateY(-1px); }.step-strip-list button.active { border-color: var(--ink); box-shadow: 0 0 0 2px var(--acid); }.step-strip-list button > i { width: 4px; height: 100%; background: #55544e; }.step-strip-list button > span { min-width: 0; display: flex; flex-direction: column; }.step-strip-list small { color: #66655e; font-size: 7px; text-transform: uppercase; }.step-strip-list strong { margin-top: 4px; overflow: hidden; font-size: 9.5px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }.step-strip-list em { padding: 3px 4px; align-self: start; background: #55544e; color: #fff; font-size: 6.5px; font-style: normal; font-weight: 800; white-space: nowrap; }.step-strip-list .step-strip-item--rule-automated > i, .step-strip-list .step-strip-item--rule-automated > em { background: #0f7049; }.step-strip-list .step-strip-item--ai-assisted > i, .step-strip-list .step-strip-item--ai-assisted > em { background: #6544c2; }.step-strip-list .step-strip-item--ai-autonomous > i, .step-strip-list .step-strip-item--ai-autonomous > em { background: #354dcc; }.step-strip-list .potential-flag { min-width: 17px; padding-inline: 3px; position: absolute; right: 5px; bottom: 5px; background: var(--acid); color: var(--ink); text-align: center; }.step-strip-list button.has-human .potential-flag { right: 54px; }.step-strip-list .human-flag, .step-strip-list .step-strip-item--ai-assisted > .human-flag, .step-strip-list .step-strip-item--ai-autonomous > .human-flag, .step-strip-list .step-strip-item--rule-automated > .human-flag { padding-inline: 5px; position: absolute; right: 5px; bottom: 5px; background: #354dcc; color: #fff; }
.canvas-loading { height: 590px; display: grid; place-items: center; background: var(--surface-soft); color: var(--muted); font-size: 11px; }
.map-insight { margin: 0 20px 20px; padding: 12px 14px; display: flex; gap: 11px; border: 1px solid #dce7fb; border-radius: 9px; background: #f5f8ff; }
.insight-icon { width: 27px; height: 27px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 7px; background: #e4edff; color: var(--accent); }.insight-icon svg { width: 15px; }
.map-insight strong { font-size: 9.5px; }.map-insight p { margin: 3px 0 0; color: var(--muted); font-size: 8.5px; line-height: 1.45; }

.responsibility-card { margin-top: 20px; padding: 0; overflow: hidden; }
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
.execution-field { padding-left: 8px; border-left: 4px solid #55544e; }.execution-field--rule-automated { border-left-color: #0f7049; }.execution-field--rule-automated select { background-color: #e4f5ec; }.execution-field--ai-assisted { border-left-color: #6544c2; }.execution-field--ai-assisted select { background-color: #eee9ff; }.execution-field--ai-autonomous { border-left-color: #354dcc; }.execution-field--ai-autonomous select { background-color: #e6edff; }
.toggle-field { min-height: 48px; position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; }.toggle-field > span { display: flex; flex-direction: column; }.toggle-field strong { font-size: 8.5px; }.toggle-field small { margin-top: 2px; color: var(--muted); font-size: 7.5px; }.active-info-tag { margin-left: 4px; padding: 2px 5px; display: inline-block; background: #354dcc; color: #fff; font-size: 7px; font-style: normal; text-transform: uppercase; }.toggle-field input { position: absolute; opacity: 0; }.toggle-field i { width: 31px; height: 17px; position: relative; flex: 0 0 auto; border-radius: 9px; background: #d7dde6; transition: 150ms; }.toggle-field i::after { content: ''; position: absolute; top: 3px; left: 3px; width: 11px; height: 11px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.18); transition: 150ms; }.toggle-field input:checked + i { background: var(--accent); }.toggle-field input:checked + i::after { transform: translateX(14px); }
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
.ai-create-button { background: var(--acid); color: var(--ink); }.ai-create-button:hover { background: var(--ink); color: var(--paper); }
.ai-modal-backdrop { padding: 24px; overflow-y: auto; }.ai-process-modal { width: min(1180px, 100%); max-height: calc(100vh - 48px); padding: 0; overflow-y: auto; }.ai-modal-head { padding: 22px 24px; display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; border-bottom: 1px solid var(--border-strong); background: var(--surface-soft); }.ai-modal-head h2 { margin: 4px 0 7px; }.ai-modal-head span { color: var(--muted); font-size: 11px; }.ai-modal-grid { display: grid; grid-template-columns: minmax(0, 620px); justify-content: center; }.ai-modal-grid.has-preview { grid-template-columns: minmax(320px, .8fr) minmax(520px, 1.4fr); }.ai-prompt-column { padding: 22px 24px; display: grid; gap: 15px; }.ai-prompt-column textarea { min-height: 90px; font-size: 12px; line-height: 1.5; }.speech-controls { min-height: 42px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }.speech-controls button { min-height: 36px; font-size: 9px; }.recording-state { display: inline-flex; align-items: center; gap: 7px; color: var(--err); font-size: 11px; font-weight: 700; }.recording-state i { width: 9px; height: 9px; border-radius: 50%; background: var(--err); animation: recording-pulse 1.2s infinite; }.transcribing-state { color: var(--purple); font-size: 11px; font-weight: 700; }.ai-generate { width: 100%; min-height: 45px; }.ai-error { margin: 0; padding: 11px 12px; border: 1px solid var(--err); background: var(--err-soft); color: var(--err); font-size: 11px; line-height: 1.5; }.ai-preview-column { min-width: 0; padding: 22px 24px; border-left: 1px solid var(--border-strong); background: var(--surface-muted); }.ai-preview-head { margin-bottom: 11px; display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }.ai-preview-head > div { display: flex; flex-direction: column; }.ai-preview-head span { color: var(--muted); font-size: 10px; }.ai-preview-head strong { margin-top: 3px; font-size: 16px; }.ai-bpmn-preview { height: 350px; overflow: hidden; border: 1px solid var(--ink); background: #fff; }.ai-bpmn-preview :deep(.bpmn-designer) { min-height: 350px; }.draft-notes { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }.draft-notes > div { padding: 10px 12px; border: 1px solid var(--border); background: var(--surface); }.draft-notes strong { font-size: 11px; }.draft-notes ul { margin: 7px 0 0; padding-left: 17px; color: var(--muted); font-size: 10px; line-height: 1.5; }.draft-warnings { border-color: var(--warn) !important; background: var(--warn-soft) !important; }.ai-preview-actions { position: sticky; bottom: 0; padding-top: 14px; background: var(--surface-muted); }
@keyframes recording-pulse { 50% { opacity: .35; transform: scale(.8); } }
.transfer-notice { width: min(470px, calc(100vw - 34px)); min-height: 70px; position: fixed; z-index: 120; right: 22px; bottom: 22px; padding: 13px 13px 13px 15px; display: flex; align-items: center; gap: 11px; border: 1px solid #b9e0d0; border-radius: 12px; background: #fff; color: var(--ok); box-shadow: 0 16px 42px rgba(20,34,56,.18); }.transfer-notice--error { border-color: #f2bcbc; color: var(--err); }.notice-icon { width: 31px; height: 31px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 8px; background: var(--ok-soft); }.transfer-notice--error .notice-icon { background: var(--err-soft); }.notice-icon svg { width: 17px; }.transfer-notice > span:nth-child(2) { min-width: 0; display: flex; flex: 1; flex-direction: column; }.transfer-notice strong { color: var(--text); font-size: 9.5px; }.transfer-notice small { margin-top: 3px; color: var(--muted); font-size: 8px; line-height: 1.4; }.transfer-notice > button { width: 25px; min-height: 25px; padding: 0; border-color: transparent; background: transparent; color: var(--muted); font-size: 16px; }.transfer-notice > button:hover { border-color: transparent; background: var(--surface-soft); color: var(--text); transform: none; }.notice-enter-active, .notice-leave-active { transition: opacity 180ms, transform 180ms; }.notice-enter-from, .notice-leave-to { opacity: 0; transform: translateY(12px); }
.transfer-notice .notice-undo { width: auto; padding: 0 9px; border-color: var(--ok); color: var(--ok); font-size: 10px; }

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
  .ai-modal-grid.has-preview { grid-template-columns: 1fr; }.ai-preview-column { border-top: 1px solid var(--border-strong); border-left: 0; }
  .designer-step-strip { flex-direction: column; }.step-strip-intro { width: auto; }.step-strip-list button { width: 176px; }
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

@container (max-width: 1260px) {
  .page-head { align-items: stretch; flex-direction: column; }
  .page-head > div:first-child { flex: none; }
  .page-actions { width: 100%; flex: none; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); justify-content: stretch; }
  .page-actions button { width: 100%; }
}

@container (max-width: 900px) {
  .page-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .process-viewbar { align-items: flex-start; flex-wrap: wrap; }
  .view-context { order: 3; width: 100%; padding: 0 4px 4px; }
}

@container (max-width: 620px) {
  .page-actions { grid-template-columns: 1fr; }
  .demo-controls { width: 100%; margin-left: 0; align-items: stretch; flex-wrap: wrap; }
  .demo-picker { width: 100%; }
  .demo-picker select { min-width: 0; flex: 1; }
  .reset-link { flex: 1; }
}
</style>
