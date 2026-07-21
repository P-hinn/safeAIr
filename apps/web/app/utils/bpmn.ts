import type {
  BusinessProcess,
  BpmnDocument,
  AutomationPotential,
  ExecutionMode,
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
  document: BpmnDocument
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
  , 'intermediateCatchEvent'
  , 'intermediateThrowEvent'
  , 'boundaryEvent'
  , 'subProcess'
  , 'callActivity'
])

function localName(element: Element): string {
  const name = element.localName || element.tagName
  return name.includes(':') ? name.split(':').at(-1) ?? name : name
}

function elementsByLocalName(root: ParentNode, name: string): Element[] {
  return Array.from(root.querySelectorAll('*')).filter((element) => localName(element) === name)
}

function directChildren(root: Element, name?: string): Element[] {
  return Array.from(root.children).filter((element) => !name || localName(element) === name)
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
  const name = localName(element)
  if (['trigger', 'task', 'ai', 'decision', 'approval', 'end'].includes(explicit)) return explicit as WorkflowNodeType
  if (name === 'startEvent') return 'trigger'
  if (name === 'endEvent') return 'end'
  if (name.endsWith('Gateway')) return 'decision'
  if (name === 'userTask' || name === 'manualTask') return 'approval'
  if (['serviceTask', 'scriptTask', 'businessRuleTask'].includes(name) || toolIds.length) return 'ai'
  return 'task'
}

function bpmnElementType(element: Element): string {
  const name = localName(element)
  return `bpmn:${name.charAt(0).toUpperCase()}${name.slice(1)}`
}

function executionMode(element: Element, toolIds: string[]): ExecutionMode {
  const explicit = customAttribute(element, 'executionMode')
  if (['manual', 'rule_automated', 'ai_assisted', 'ai_autonomous'].includes(explicit)) return explicit as ExecutionMode
  if (toolIds.some((id) => ['gpt-4o', 'claude', 'llama'].includes(id))) return 'ai_assisted'
  if (['serviceTask', 'scriptTask', 'businessRuleTask'].includes(localName(element))) return 'rule_automated'
  return 'manual'
}

function automationPotential(element: Element, mode: ExecutionMode): AutomationPotential {
  const explicit = customAttribute(element, 'automationPotential')
  if (['none', 'partial', 'full'].includes(explicit)) return explicit as AutomationPotential
  return mode === 'manual' ? 'partial' : 'full'
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

function laneMap(processElement: Element) {
  const departments = new Map<string, string>()
  for (const lane of elementsByLocalName(processElement, 'lane')) {
    const name = lane.getAttribute('name') || 'Fachbereich'
    for (const reference of directChildren(lane, 'flowNodeRef')) {
      const id = reference.textContent?.trim()
      if (id) departments.set(id, name)
    }
  }
  return departments
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
    const flowElements = directChildren(processElement).filter((element) => nodeNames.has(localName(element)))
    const lanes = laneMap(processElement)
    if (!flowElements.length) {
      warnings.push(`${processElement.getAttribute('name') || rawProcessId}: keine unterstützten BPMN-Aktivitäten gefunden.`)
      continue
    }

    const steps: ProcessStep[] = flowElements.map((element, index) => {
      const id = element.getAttribute('id') || `${rawProcessId}-step-${index + 1}`
      const toolIds = customAttribute(element, 'toolIds').split(',').map((item) => item.trim()).filter(Boolean)
      const type = workflowType(element, toolIds)
      const nativeType = bpmnElementType(element)
      const mode = executionMode(element, toolIds)
      const importedPosition = positions.get(id)
      return {
        id,
        title: element.getAttribute('name') || `Prozessschritt ${index + 1}`,
        description: documentation(element) || 'Aus BPMN importierter Prozessschritt.',
        owner: customAttribute(element, 'owner') || 'Noch nicht zugewiesen',
        department: customAttribute(element, 'department') || lanes.get(id) || 'Fachbereich',
        risk: validRisk(customAttribute(element, 'risk'), defaultRisk(type)),
        toolIds,
        humanApproval: customAttribute(element, 'humanApproval') === 'true' || type === 'approval',
        control: customAttribute(element, 'control') || 'Kontrollmaßnahme nach Import prüfen.',
        workflowType: type,
        bpmnElementType: nativeType,
        executionMode: mode,
        automationPotential: automationPotential(element, mode),
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
      connections,
      bpmnProcessRef: rawProcessId
    })
  }

  if (!processes.length) throw new Error('Keine importierbaren BPMN-Prozesse gefunden.')
  const definitions = elementsByLocalName(document, 'definitions')[0]
  const documentId = definitions?.getAttribute('id') || `bpmn-document-${Date.now()}`
  return {
    processes,
    warnings,
    document: {
      id: documentId,
      xml,
      processRefs: processes.map((process) => process.bpmnProcessRef || process.id),
      updatedAt: new Date().toISOString()
    }
  }
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

function nodeTag(type: WorkflowNodeType, nativeType?: string): string {
  const fromNative = nativeType?.replace(/^bpmn:/, '')
  if (fromNative && nodeNames.has(fromNative.charAt(0).toLowerCase() + fromNative.slice(1))) {
    return fromNative.charAt(0).toLowerCase() + fromNative.slice(1)
  }
  if (type === 'trigger') return 'startEvent'
  if (type === 'end') return 'endEvent'
  if (type === 'decision') return 'exclusiveGateway'
  if (type === 'approval') return 'userTask'
  if (type === 'ai') return 'serviceTask'
  return 'task'
}

function nodeDimensions(type: WorkflowNodeType, nativeType?: string) {
  if (nativeType === 'bpmn:SubProcess') return { width: 260, height: 150 }
  if (nativeType === 'bpmn:CallActivity') return { width: 180, height: 86 }
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
    const processId = uniqueId(xmlId(process.bpmnProcessRef || process.id, `Process_${processIndex + 1}`))
    const stepIds = new Map(process.steps.map((step, index) => [step.id, uniqueId(xmlId(step.id, `Step_${index + 1}`))]))
    const edgeIds = new Map(process.connections.map((edge, index) => [edge.id, uniqueId(xmlId(edge.id, `Flow_${index + 1}`))]))
    const departments = [...new Set(process.steps.map((step) => step.department || 'Fachbereich'))]
    const laneIds = new Map(departments.map((department, index) => [department, uniqueId(xmlId(`${processId}_Lane_${department}`, `Lane_${index + 1}`))]))
    const exportedPosition = (step: ProcessStep) => ({
      x: step.position.x,
      y: departments.length > 1 ? 120 + Math.max(0, departments.indexOf(step.department || 'Fachbereich')) * 180 : step.position.y
    })
    const laneDefinitions = departments.map((department) => [
      `      <bpmn:lane id="${escapeXml(laneIds.get(department))}" name="${escapeXml(department)}">`,
      ...process.steps.filter((step) => (step.department || 'Fachbereich') === department).map((step) => `        <bpmn:flowNodeRef>${escapeXml(stepIds.get(step.id))}</bpmn:flowNodeRef>`),
      '      </bpmn:lane>'
    ].join('\n'))

    const nodes = process.steps.map((step) => {
      const id = stepIds.get(step.id)!
      const incoming = process.connections.filter((edge) => edge.target === step.id).map((edge) => `      <bpmn:incoming>${escapeXml(edgeIds.get(edge.id))}</bpmn:incoming>`)
      const outgoing = process.connections.filter((edge) => edge.source === step.id).map((edge) => `      <bpmn:outgoing>${escapeXml(edgeIds.get(edge.id))}</bpmn:outgoing>`)
      const attributes = [
        `id="${escapeXml(id)}"`,
        `name="${escapeXml(step.title)}"`,
        `safair:workflowType="${step.workflowType}"`,
        `safair:bpmnElementType="${escapeXml(step.bpmnElementType)}"`,
        `safair:executionMode="${step.executionMode}"`,
        `safair:automationPotential="${step.automationPotential}"`,
        `safair:owner="${escapeXml(step.owner)}"`,
        `safair:department="${escapeXml(step.department)}"`,
        `safair:risk="${step.risk}"`,
        `safair:humanApproval="${step.humanApproval}"`,
        `safair:control="${escapeXml(step.control)}"`,
        `safair:toolIds="${escapeXml(step.toolIds.join(','))}"`
      ].join(' ')
      return [
        `    <bpmn:${nodeTag(step.workflowType, step.bpmnElementType)} ${attributes}>`,
        `      <bpmn:documentation>${escapeXml(step.description)}</bpmn:documentation>`,
        ...incoming,
        ...outgoing,
        `    </bpmn:${nodeTag(step.workflowType, step.bpmnElementType)}>`
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
      `    <bpmn:laneSet id="${escapeXml(processId)}_LaneSet">`,
      ...laneDefinitions,
      '    </bpmn:laneSet>',
      ...nodes,
      ...flows,
      '  </bpmn:process>'
    ].join('\n'))

    const positions = new Map(process.steps.map((step) => [step.id, exportedPosition(step)]))
    const diagramRight = Math.max(...process.steps.map((step) => exportedPosition(step).x + nodeDimensions(step.workflowType, step.bpmnElementType).width), 900) + 100
    const laneShapes = departments.map((department, laneIndex) => [
      `      <bpmndi:BPMNShape id="${escapeXml(laneIds.get(department))}_di" bpmnElement="${escapeXml(laneIds.get(department))}" isHorizontal="true">`,
      `        <dc:Bounds x="30" y="${departments.length > 1 ? 70 + laneIndex * 180 : 70}" width="${Math.max(1000, diagramRight)}" height="180" />`,
      '      </bpmndi:BPMNShape>'
    ].join('\n'))
    const shapes = process.steps.map((step) => {
      const dimensions = nodeDimensions(step.workflowType, step.bpmnElementType)
      const position = positions.get(step.id)!
      return [
        `      <bpmndi:BPMNShape id="${escapeXml(stepIds.get(step.id))}_di" bpmnElement="${escapeXml(stepIds.get(step.id))}">`,
        `        <dc:Bounds x="${Math.round(position.x)}" y="${Math.round(position.y)}" width="${dimensions.width}" height="${dimensions.height}" />`,
        '      </bpmndi:BPMNShape>'
      ].join('\n')
    })

    const edges = process.connections.flatMap((edge) => {
      const source = process.steps.find((step) => step.id === edge.source)
      const target = process.steps.find((step) => step.id === edge.target)
      if (!source || !target) return []
      const sourceSize = nodeDimensions(source.workflowType, source.bpmnElementType)
      const targetSize = nodeDimensions(target.workflowType, target.bpmnElementType)
      const sourcePosition = positions.get(source.id)!
      const targetPosition = positions.get(target.id)!
      return [[
        `      <bpmndi:BPMNEdge id="${escapeXml(edgeIds.get(edge.id))}_di" bpmnElement="${escapeXml(edgeIds.get(edge.id))}">`,
        `        <di:waypoint x="${Math.round(sourcePosition.x + sourceSize.width)}" y="${Math.round(sourcePosition.y + sourceSize.height / 2)}" />`,
        `        <di:waypoint x="${Math.round(targetPosition.x)}" y="${Math.round(targetPosition.y + targetSize.height / 2)}" />`,
        '      </bpmndi:BPMNEdge>'
      ].join('\n')]
    })

    diagrams.push([
      `  <bpmndi:BPMNDiagram id="BPMNDiagram_${processIndex + 1}">`,
      `    <bpmndi:BPMNPlane id="BPMNPlane_${processIndex + 1}" bpmnElement="${escapeXml(processId)}">`,
      ...laneShapes,
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
