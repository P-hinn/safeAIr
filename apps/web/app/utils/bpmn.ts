import type {
  BusinessProcess,
  LandscapeLayer,
  ProcessRelation,
  ProcessStatus,
  ProcessStep,
  RiskLevel,
  WorkflowConnection,
  WorkflowNodeType
} from '~/composables/useProcessMap'

const SAFAIR_NS = 'https://safair.local/schema/bpmn'

export interface BpmnImportResult {
  processes: BusinessProcess[]
  warnings: string[]
}

const nodeNames = new Set([
  'startEvent',
  'endEvent',
  'task',
  'userTask',
  'manualTask',
  'serviceTask',
  'scriptTask',
  'businessRuleTask',
  'sendTask',
  'receiveTask',
  'exclusiveGateway',
  'inclusiveGateway',
  'parallelGateway',
  'complexGateway',
  'eventBasedGateway'
])

function elementsByLocalName(root: ParentNode, name: string): Element[] {
  return Array.from(root.querySelectorAll('*')).filter((element) => element.localName === name)
}

function directChildren(root: Element, name?: string): Element[] {
  return Array.from(root.children).filter((element) => !name || element.localName === name)
}

function customAttribute(element: Element, name: string): string {
  return element.getAttributeNS(SAFAIR_NS, name)
    ?? element.getAttribute(`safair:${name}`)
    ?? ''
}

function documentation(element: Element): string {
  return directChildren(element, 'documentation')[0]?.textContent?.trim() ?? ''
}

function validStatus(value: string): ProcessStatus {
  return value === 'active' || value === 'pilot' || value === 'planned' ? value : 'planned'
}

function validRisk(value: string, fallback: RiskLevel): RiskLevel {
  return value === 'low' || value === 'medium' || value === 'high' ? value : fallback
}

function validLayer(value: string): LandscapeLayer {
  return value === 'management' || value === 'core' || value === 'support' ? value : 'core'
}

function workflowType(element: Element, toolIds: string[]): WorkflowNodeType {
  const explicit = customAttribute(element, 'workflowType')
  if (['trigger', 'task', 'ai', 'decision', 'approval', 'end'].includes(explicit)) return explicit as WorkflowNodeType
  if (element.localName === 'startEvent') return 'trigger'
  if (element.localName === 'endEvent') return 'end'
  if (element.localName.endsWith('Gateway')) return 'decision'
  if (element.localName === 'userTask' || element.localName === 'manualTask') return 'approval'
  if (['serviceTask', 'scriptTask', 'businessRuleTask'].includes(element.localName) || toolIds.length) return 'ai'
  return 'task'
}

function defaultRisk(type: WorkflowNodeType): RiskLevel {
  return type === 'decision' || type === 'approval' ? 'high' : type === 'ai' ? 'medium' : 'low'
}

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function positionMap(document: XMLDocument) {
  const positions = new Map<string, { x: number; y: number }>()
  for (const shape of elementsByLocalName(document, 'BPMNShape')) {
    const elementId = shape.getAttribute('bpmnElement')
    const bounds = elementsByLocalName(shape, 'Bounds')[0]
    if (!elementId || !bounds) continue
    positions.set(elementId, {
      x: Math.round(parseNumber(bounds.getAttribute('x') ?? '', 0)),
      y: Math.round(parseNumber(bounds.getAttribute('y') ?? '', 0))
    })
  }
  return positions
}

function connectionCondition(element: Element): WorkflowConnection['condition'] {
  const explicit = customAttribute(element, 'condition')
  if (explicit === 'yes' || explicit === 'no' || explicit === 'fallback') return explicit
  const label = (element.getAttribute('name') ?? '').toLowerCase()
  if (/\b(ja|yes|approved|freigegeben)\b/.test(label)) return 'yes'
  if (/\b(nein|no|rejected|abgelehnt)\b/.test(label)) return 'no'
  if (/fallback|fehler|error/.test(label)) return 'fallback'
  return 'always'
}

function processRelations(element: Element): ProcessRelation[] {
  const value = customAttribute(element, 'relations')
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry, index) => {
      if (!entry || typeof entry !== 'object') return []
      const relation = entry as Record<string, unknown>
      const targetId = typeof relation.targetId === 'string' ? relation.targetId : ''
      const type = relation.type
      if (!targetId || !['handoff', 'governance', 'support', 'data'].includes(String(type))) return []
      return [{
        id: typeof relation.id === 'string' && relation.id ? relation.id : `imported-relation-${index + 1}`,
        targetId,
        type: type as ProcessRelation['type'],
        label: typeof relation.label === 'string' ? relation.label : 'Prozessübergabe'
      }]
    })
  } catch {
    return []
  }
}

export function parseBpmn(xml: string): BpmnImportResult {
  if (typeof DOMParser === 'undefined') throw new Error('BPMN-Import ist nur im Browser verfügbar.')
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (elementsByLocalName(document, 'parsererror').length) {
    throw new Error('Die Datei enthält kein gültiges XML.')
  }

  const positions = positionMap(document)
  const warnings: string[] = []
  const processes: BusinessProcess[] = []

  for (const [processIndex, processElement] of elementsByLocalName(document, 'process').entries()) {
    const rawProcessId = processElement.getAttribute('id') || `imported-process-${processIndex + 1}`
    const flowElements = directChildren(processElement).filter((element) => nodeNames.has(element.localName))
    if (!flowElements.length) {
      warnings.push(`${processElement.getAttribute('name') || rawProcessId}: keine unterstützten BPMN-Aktivitäten gefunden.`)
      continue
    }

    const steps: ProcessStep[] = flowElements.map((element, index) => {
      const id = element.getAttribute('id') || `${rawProcessId}-step-${index + 1}`
      const toolIds = customAttribute(element, 'toolIds').split(',').map((item) => item.trim()).filter(Boolean)
      const type = workflowType(element, toolIds)
      const importedPosition = positions.get(id)
      return {
        id,
        title: element.getAttribute('name') || `Prozessschritt ${index + 1}`,
        description: documentation(element) || 'Aus BPMN importierter Prozessschritt.',
        owner: customAttribute(element, 'owner') || 'Noch nicht zugewiesen',
        department: customAttribute(element, 'department') || 'Fachbereich',
        risk: validRisk(customAttribute(element, 'risk'), defaultRisk(type)),
        toolIds,
        humanApproval: customAttribute(element, 'humanApproval') === 'true' || type === 'approval',
        control: customAttribute(element, 'control') || 'Kontrollmaßnahme nach Import prüfen.',
        workflowType: type,
        position: importedPosition ?? {
          x: 80 + (index % 4) * 280,
          y: 120 + Math.floor(index / 4) * 220
        }
      }
    })

    const stepIds = new Set(steps.map((step) => step.id))
    const connections: WorkflowConnection[] = directChildren(processElement, 'sequenceFlow').flatMap((element, index) => {
      const source = element.getAttribute('sourceRef') ?? ''
      const target = element.getAttribute('targetRef') ?? ''
      if (!stepIds.has(source) || !stepIds.has(target)) return []
      const condition = connectionCondition(element)
      return [{
        id: element.getAttribute('id') || `${rawProcessId}-flow-${index + 1}`,
        source,
        target,
        sourceHandle: condition === 'yes' || condition === 'no' ? condition : undefined,
        label: element.getAttribute('name') || undefined,
        condition
      }]
    })

    processes.push({
      id: rawProcessId,
      name: processElement.getAttribute('name') || `Importierter Prozess ${processIndex + 1}`,
      description: documentation(processElement) || 'Aus einer BPMN-2.0-Datei importierter Geschäftsprozess.',
      owner: customAttribute(processElement, 'owner') || 'Noch nicht zugewiesen',
      status: validStatus(customAttribute(processElement, 'status')),
      maturity: Math.min(100, Math.max(0, Math.round(parseNumber(customAttribute(processElement, 'maturity'), 30)))),
      volume: customAttribute(processElement, 'volume') || 'Volumen noch offen',
      landscapeLayer: validLayer(customAttribute(processElement, 'landscapeLayer')),
      domain: customAttribute(processElement, 'domain') || 'Importierte Prozesse',
      relations: processRelations(processElement),
      steps,
      connections
    })
  }

  if (!processes.length) throw new Error('Keine importierbaren BPMN-Prozesse gefunden.')
  return { processes, warnings }
}

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function xmlId(value: string, prefix: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_.-]/g, '_')
  return /^[A-Za-z_]/.test(normalized) ? normalized : `${prefix}_${normalized}`
}

function nodeTag(type: WorkflowNodeType): string {
  if (type === 'trigger') return 'startEvent'
  if (type === 'end') return 'endEvent'
  if (type === 'decision') return 'exclusiveGateway'
  if (type === 'approval') return 'userTask'
  if (type === 'ai') return 'serviceTask'
  return 'task'
}

function nodeDimensions(type: WorkflowNodeType) {
  if (type === 'trigger' || type === 'end') return { width: 42, height: 42 }
  if (type === 'decision') return { width: 56, height: 56 }
  return { width: 180, height: 86 }
}

export function createBpmn(processes: BusinessProcess[]): string {
  if (!processes.length) throw new Error('Keine Prozesse zum Exportieren vorhanden.')
  const processXml: string[] = []
  const diagrams: string[] = []
  const usedIds = new Set<string>()

  const uniqueId = (candidate: string) => {
    let result = candidate
    let suffix = 2
    while (usedIds.has(result)) result = `${candidate}_${suffix++}`
    usedIds.add(result)
    return result
  }

  for (const [processIndex, process] of processes.entries()) {
    const processId = uniqueId(xmlId(process.id, `Process_${processIndex + 1}`))
    const stepIds = new Map(process.steps.map((step, index) => [step.id, uniqueId(xmlId(`${processId}_${step.id}`, `Step_${index + 1}`))]))
    const edgeIds = new Map(process.connections.map((edge, index) => [edge.id, uniqueId(xmlId(`${processId}_${edge.id}`, `Flow_${index + 1}`))]))

    const nodes = process.steps.map((step) => {
      const id = stepIds.get(step.id)!
      const incoming = process.connections.filter((edge) => edge.target === step.id).map((edge) => `      <bpmn:incoming>${escapeXml(edgeIds.get(edge.id))}</bpmn:incoming>`)
      const outgoing = process.connections.filter((edge) => edge.source === step.id).map((edge) => `      <bpmn:outgoing>${escapeXml(edgeIds.get(edge.id))}</bpmn:outgoing>`)
      const attributes = [
        `id="${escapeXml(id)}"`,
        `name="${escapeXml(step.title)}"`,
        `safair:workflowType="${step.workflowType}"`,
        `safair:owner="${escapeXml(step.owner)}"`,
        `safair:department="${escapeXml(step.department)}"`,
        `safair:risk="${step.risk}"`,
        `safair:humanApproval="${step.humanApproval}"`,
        `safair:control="${escapeXml(step.control)}"`,
        `safair:toolIds="${escapeXml(step.toolIds.join(','))}"`
      ].join(' ')
      return [
        `    <bpmn:${nodeTag(step.workflowType)} ${attributes}>`,
        `      <bpmn:documentation>${escapeXml(step.description)}</bpmn:documentation>`,
        ...incoming,
        ...outgoing,
        `    </bpmn:${nodeTag(step.workflowType)}>`
      ].join('\n')
    })

    const flows = process.connections.flatMap((edge) => {
      const sourceRef = stepIds.get(edge.source)
      const targetRef = stepIds.get(edge.target)
      if (!sourceRef || !targetRef) return []
      const name = edge.label ? ` name="${escapeXml(edge.label)}"` : ''
      return [`    <bpmn:sequenceFlow id="${escapeXml(edgeIds.get(edge.id))}" sourceRef="${escapeXml(sourceRef)}" targetRef="${escapeXml(targetRef)}"${name} safair:condition="${edge.condition}" />`]
    })

    processXml.push([
      `  <bpmn:process id="${escapeXml(processId)}" name="${escapeXml(process.name)}" isExecutable="false" safair:owner="${escapeXml(process.owner)}" safair:status="${process.status}" safair:maturity="${process.maturity}" safair:volume="${escapeXml(process.volume)}" safair:landscapeLayer="${process.landscapeLayer}" safair:domain="${escapeXml(process.domain)}" safair:relations="${escapeXml(JSON.stringify(process.relations))}">`,
      `    <bpmn:documentation>${escapeXml(process.description)}</bpmn:documentation>`,
      ...nodes,
      ...flows,
      '  </bpmn:process>'
    ].join('\n'))

    const shapes = process.steps.map((step) => {
      const dimensions = nodeDimensions(step.workflowType)
      return [
        `      <bpmndi:BPMNShape id="${escapeXml(stepIds.get(step.id))}_di" bpmnElement="${escapeXml(stepIds.get(step.id))}">`,
        `        <dc:Bounds x="${Math.round(step.position.x)}" y="${Math.round(step.position.y)}" width="${dimensions.width}" height="${dimensions.height}" />`,
        '      </bpmndi:BPMNShape>'
      ].join('\n')
    })

    const edges = process.connections.flatMap((edge) => {
      const source = process.steps.find((step) => step.id === edge.source)
      const target = process.steps.find((step) => step.id === edge.target)
      if (!source || !target) return []
      const sourceSize = nodeDimensions(source.workflowType)
      const targetSize = nodeDimensions(target.workflowType)
      return [[
        `      <bpmndi:BPMNEdge id="${escapeXml(edgeIds.get(edge.id))}_di" bpmnElement="${escapeXml(edgeIds.get(edge.id))}">`,
        `        <di:waypoint x="${Math.round(source.position.x + sourceSize.width)}" y="${Math.round(source.position.y + sourceSize.height / 2)}" />`,
        `        <di:waypoint x="${Math.round(target.position.x)}" y="${Math.round(target.position.y + targetSize.height / 2)}" />`,
        '      </bpmndi:BPMNEdge>'
      ].join('\n')]
    })

    diagrams.push([
      `  <bpmndi:BPMNDiagram id="BPMNDiagram_${processIndex + 1}">`,
      `    <bpmndi:BPMNPlane id="BPMNPlane_${processIndex + 1}" bpmnElement="${escapeXml(processId)}">`,
      ...shapes,
      ...edges,
      '    </bpmndi:BPMNPlane>',
      '  </bpmndi:BPMNDiagram>'
    ].join('\n'))
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:safair="https://safair.local/schema/bpmn" targetNamespace="https://safair.local/bpmn">',
    ...processXml,
    ...diagrams,
    '</bpmn:definitions>',
    ''
  ].join('\n')
}
