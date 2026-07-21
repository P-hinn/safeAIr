import { describe, expect, it } from 'vitest'
import { analyzeDataFlowGaps, calculateProcessMetrics, createComplexDemoProcesses, dataFlowIssues, synchronizeExecutionModeForModelTool, type BusinessProcess, type DataFlow, type ProcessStep } from '../app/composables/useProcessMap'

function step(overrides: Partial<ProcessStep>): ProcessStep {
  return {
    id: 'step',
    title: 'Aktivität',
    description: '',
    owner: 'Owner',
    department: 'Bereich',
    risk: 'medium',
    toolIds: [],
    humanApproval: false,
    control: 'Dokumentierte Kontrolle',
    workflowType: 'task',
    bpmnElementType: 'bpmn:Task',
    executionMode: 'manual',
    automationPotential: 'none',
    position: { x: 0, y: 0 },
    ...overrides
  }
}

function dataFlow(overrides: Partial<DataFlow> = {}): DataFlow {
  return {
    id: 'flow',
    label: 'Kundendaten an KI',
    sourceProcessId: 'process',
    sourceSystem: 'CRM',
    targetSystem: 'AI API',
    aiToolId: 'gpt-4o',
    dataCategories: ['Kundenanfrage'],
    sensitivity: 'internal',
    direction: 'outbound',
    aiRole: 'ai_input',
    isExternal: false,
    owner: 'AI Governance',
    controlStatus: 'covered',
    controlNote: 'Freigegeben',
    linkedPolicyIds: [],
    linkedGuardrailIds: [],
    monitoringStatus: 'expected',
    ...overrides
  }
}

function process(steps: ProcessStep[], relations: BusinessProcess['relations'] = []): BusinessProcess {
  return {
    id: 'process',
    name: 'Kundenservice',
    description: '',
    owner: 'Operations',
    status: 'active',
    maturity: 60,
    volume: '',
    landscapeLayer: 'core',
    domain: 'Service',
    relations,
    steps,
    connections: []
  }
}

describe('Management-KPIs', () => {
  it('trennt regelbasierte Automatisierung und KI', () => {
    const metrics = calculateProcessMetrics([
      step({ id: 'manual' }),
      step({ id: 'rule', bpmnElementType: 'bpmn:BusinessRuleTask', executionMode: 'rule_automated' }),
      step({ id: 'assisted', executionMode: 'ai_assisted', humanApproval: true }),
      step({ id: 'autonomous', executionMode: 'ai_autonomous' })
    ])
    expect(metrics.automationRate).toBe(75)
    expect(metrics.aiShare).toBe(50)
    expect(metrics.aiAutonomy).toBe(50)
    expect(metrics.humanOversight).toBe(50)
  })

  it('berechnet Potenzial nur im Nenner manueller Aktivitäten', () => {
    const metrics = calculateProcessMetrics([
      step({ id: 'none', automationPotential: 'none' }),
      step({ id: 'partial', automationPotential: 'partial' }),
      step({ id: 'full', automationPotential: 'full' }),
      step({ id: 'automated', executionMode: 'rule_automated', automationPotential: 'full' })
    ])
    expect(metrics.automationPotential).toBe(67)
  })

  it('schließt Events und Gateways aus dem Nenner aus', () => {
    const metrics = calculateProcessMetrics([
      step({ id: 'start', bpmnElementType: 'bpmn:StartEvent', workflowType: 'trigger' }),
      step({ id: 'gateway', bpmnElementType: 'bpmn:ExclusiveGateway', workflowType: 'decision', executionMode: 'ai_autonomous' }),
      step({ id: 'end', bpmnElementType: 'bpmn:EndEvent', workflowType: 'end' })
    ])
    expect(metrics.activities).toBe(0)
    expect(metrics.automationRate).toBe(0)
    expect(metrics.aiShare).toBe(0)
  })

  it('behandelt leere Portfolios stabil', () => {
    expect(calculateProcessMetrics([])).toMatchObject({ activities: 0, automationRate: 0, aiShare: 0, governanceScore: 0 })
  })

  it('liefert die komplexe Demo mit exakt 3/10/20 Prozessen und gültigen Beziehungen', () => {
    const processes = createComplexDemoProcesses()
    expect(processes.filter((process) => process.landscapeLayer === 'management')).toHaveLength(3)
    expect(processes.filter((process) => process.landscapeLayer === 'core')).toHaveLength(10)
    expect(processes.filter((process) => process.landscapeLayer === 'support')).toHaveLength(20)
    const ids = new Set(processes.map((process) => process.id))
    expect(processes.flatMap((process) => process.relations).every((relation) => ids.has(relation.targetId))).toBe(true)
  })

  it('synchronisiert nur echte KI-Modelle mit dem Ausführungsmodus', () => {
    const activity = step({ toolIds: ['gpt-4o'] })
    synchronizeExecutionModeForModelTool(activity, 'gpt-4o')
    expect(activity.executionMode).toBe('ai_assisted')

    activity.toolIds = ['safair-guard']
    synchronizeExecutionModeForModelTool(activity, 'gpt-4o')
    expect(activity.executionMode).toBe('manual')

    activity.executionMode = 'rule_automated'
    synchronizeExecutionModeForModelTool(activity, 'safair-guard')
    expect(activity.executionMode).toBe('rule_automated')
  })

  it('erkennt ein KI-Verfahren ohne dokumentierten Input-Datenfluss', () => {
    const gaps = analyzeDataFlowGaps([process([step({ executionMode: 'ai_assisted' })])], [])
    expect(gaps.map((gap) => gap.type)).toContain('ai_without_input')
  })

  it('priorisiert externe, personenbezogene, ownerlose und unklassifizierte Übergaben', () => {
    const portfolio = [process(
      [step({ executionMode: 'ai_assisted' })],
      [{ id: 'handoff', targetId: 'target', type: 'handoff', label: 'Übergabe' }]
    ), { ...process([]), id: 'target', name: 'Zielprozess' }]
    const flow = dataFlow({
      sensitivity: 'personal',
      isExternal: true,
      owner: '',
      controlStatus: 'review_required'
    })

    expect(dataFlowIssues(flow)).toEqual(expect.arrayContaining(['Owner fehlt', 'Externe Kontrolle prüfen', 'PII-Schutz fehlt']))
    expect(analyzeDataFlowGaps(portfolio, [flow]).map((gap) => gap.type)).toEqual(expect.arrayContaining([
      'external_uncontrolled',
      'personal_unprotected',
      'owner_missing',
      'handoff_unclassified'
    ]))
  })
})
