import { readFileSync } from 'node:fs'
import { DOMParser } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { parseBpmn } from '../app/utils/bpmn'

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
