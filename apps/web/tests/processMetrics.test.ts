import { describe, expect, it } from 'vitest'
import { calculateProcessMetrics, createComplexDemoProcesses, synchronizeExecutionModeForModelTool, type ProcessStep } from '../app/composables/useProcessMap'

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
})
