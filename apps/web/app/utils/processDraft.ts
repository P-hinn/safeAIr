import type {
  AutomationPotential,
  BpmnDocument,
  BusinessProcess,
  ExecutionMode,
  LandscapeLayer,
  ProcessStep,
  RiskLevel,
  WorkflowNodeType
} from '~/composables/useProcessMap'
import { createBpmn } from '~/utils/bpmn'

export interface AiProcessDraft {
  name: string
  description: string
  owner: string
  domain: string
  landscape_layer: LandscapeLayer
  lanes: Array<{ id: string; name: string }>
  activities: Array<{
    id: string
    name: string
    description: string
    bpmn_element_type: string
    lane_id: string | null
    execution_mode: ExecutionMode
    automation_potential: AutomationPotential
    risk: RiskLevel
    human_approval: boolean
    control: string
  }>
  flows: Array<{ id: string; source: string; target: string; label: string | null }>
  assumptions: string[]
  warnings: string[]
}

function slug(value: string) {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  return normalized || `ki-prozess-${Date.now()}`
}

function workflowType(type: string, mode: ExecutionMode): WorkflowNodeType {
  if (type === 'startEvent') return 'trigger'
  if (type === 'endEvent') return 'end'
  if (type.endsWith('Gateway')) return 'decision'
  if (type === 'userTask' || type === 'manualTask') return 'approval'
  if (mode === 'ai_assisted' || mode === 'ai_autonomous') return 'ai'
  return 'task'
}

export function materializeAiDraft(draft: AiProcessDraft): { process: BusinessProcess; document: BpmnDocument } {
  const processId = `${slug(draft.name)}-${Date.now().toString(36)}`
  const laneNames = new Map(draft.lanes.map((lane) => [lane.id, lane.name]))
  const steps: ProcessStep[] = draft.activities.map((activity, index) => ({
    id: activity.id,
    title: activity.name,
    description: activity.description || 'Aus dem KI-Entwurf übernommene Aktivität.',
    owner: draft.owner || 'Noch nicht zugewiesen',
    department: (activity.lane_id && laneNames.get(activity.lane_id)) || draft.domain || 'Fachbereich',
    risk: activity.risk,
    toolIds: activity.execution_mode.startsWith('ai_') ? ['gpt-4o'] : [],
    humanApproval: activity.human_approval,
    control: activity.control || 'Kontrollmaßnahme im Review ergänzen.',
    workflowType: workflowType(activity.bpmn_element_type, activity.execution_mode),
    bpmnElementType: `bpmn:${activity.bpmn_element_type.charAt(0).toUpperCase()}${activity.bpmn_element_type.slice(1)}`,
    executionMode: activity.execution_mode,
    automationPotential: activity.automation_potential,
    position: { x: 100 + index * 210, y: 120 }
  }))
  const process: BusinessProcess = {
    id: processId,
    bpmnProcessRef: processId,
    name: draft.name,
    description: draft.description,
    owner: draft.owner || 'Noch nicht zugewiesen',
    status: 'planned',
    maturity: 25,
    volume: 'Volumen noch offen',
    landscapeLayer: draft.landscape_layer,
    domain: draft.domain || 'Geschäftsprozesse',
    relations: [],
    steps,
    connections: draft.flows.map((flow) => ({
      id: flow.id,
      source: flow.source,
      target: flow.target,
      label: flow.label || undefined,
      condition: flow.label?.toLowerCase().includes('nein') ? 'no' : flow.label?.toLowerCase().includes('ja') ? 'yes' : 'always'
    }))
  }
  const xml = createBpmn([process])
  const document: BpmnDocument = {
    id: `bpmn-document-${processId}`,
    xml,
    processRefs: [processId],
    updatedAt: new Date().toISOString()
  }
  return { process, document }
}
