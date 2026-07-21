import { readFileSync } from 'node:fs'
import { DOMParser } from 'linkedom'
import { describe, expect, it } from 'vitest'
import type { BusinessProcess } from '../app/composables/useProcessMap'
import { createBpmn, parseBpmn } from '../app/utils/bpmn'

const fixturePath = process.env.BPMN_FIXTURE

describe.skipIf(!fixturePath)('Camunda BPMN import', () => {
  it('behält das Originaldokument und projiziert Lanes, Nodes, Flows und Positionen', () => {
    ;(globalThis as any).DOMParser = DOMParser
    const xml = readFileSync(fixturePath!, 'utf8')
    const result = parseBpmn(xml)
    const process = result.processes[0]!

    expect(result.document.xml).toBe(xml)
    expect(result.document.processRefs).toEqual(['Process_1'])
    expect(process.steps).toHaveLength(15)
    expect(process.connections).toHaveLength(15)
    expect(new Set(process.steps.map((step) => step.department))).toEqual(new Set([
      'Kanzlerin', 'Hochschuldigitalisierung', 'Prozess-verantwortlicher', 'Organisations-entwicklung'
    ]))
    expect(process.steps.find((step) => step.id === 'Task_BPMN')?.position).toEqual({ x: 836, y: 330 })
  })
})

describe('safeAIr BPMN governance metadata', () => {
  it('behält die schrittbezogene Ausführungs-Governance beim Export und Re-Import', () => {
    ;(globalThis as any).DOMParser = DOMParser
    const process: BusinessProcess = {
      id: 'data-flow-process',
      name: 'Datenfluss-Test',
      description: 'Testprozess',
      owner: 'AI Governance',
      status: 'pilot',
      maturity: 50,
      volume: '10 / Monat',
      landscapeLayer: 'core',
      domain: 'Operations',
      relations: [],
      connections: [],
      steps: [{
        id: 'ai-step',
        title: 'Antwort erzeugen',
        description: 'Erzeugt einen Entwurf.',
        owner: 'Service Team',
        department: 'Operations',
        risk: 'high',
        toolIds: ['gpt-4o'],
        humanApproval: true,
        control: 'PII wird maskiert.',
        workflowType: 'ai',
        bpmnElementType: 'bpmn:ServiceTask',
        executionMode: 'ai_assisted',
        automationPotential: 'full',
        position: { x: 100, y: 120 }
      }]
    }

    const imported = parseBpmn(createBpmn([process])).processes[0]?.steps[0]
    expect(imported).toMatchObject({
      owner: 'Service Team',
      executionMode: 'ai_assisted',
      toolIds: ['gpt-4o'],
      humanApproval: true,
      control: 'PII wird maskiert.'
    })
  })
})
