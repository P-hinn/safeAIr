const DI_NS = 'http://www.omg.org/spec/DD/20100524/DI'
const FLOW_NODE_NAMES = new Set([
  'startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent',
  'task', 'userTask', 'manualTask', 'serviceTask', 'scriptTask', 'businessRuleTask', 'sendTask',
  'receiveTask', 'exclusiveGateway', 'inclusiveGateway', 'parallelGateway', 'complexGateway',
  'eventBasedGateway', 'subProcess', 'callActivity'
])

function all(root: ParentNode, localName: string) {
  return Array.from(root.querySelectorAll('*')).filter((element) => element.localName === localName)
}

function children(root: Element, localName?: string) {
  return Array.from(root.children).filter((element) => !localName || element.localName === localName)
}

function number(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function layoutBpmnXml(xml: string): Promise<string> {
  if (typeof DOMParser === 'undefined') throw new Error('Das BPMN-Layout ist nur im Browser verfügbar.')
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (all(document, 'parsererror').length) throw new Error('Das BPMN-Dokument ist ungültig.')

  const shapes = new Map<string, Element>()
  for (const shape of all(document, 'BPMNShape')) {
    const id = shape.getAttribute('bpmnElement')
    if (id) shapes.set(id, shape)
  }
  const edgeShapes = new Map<string, Element>()
  for (const edge of all(document, 'BPMNEdge')) {
    const id = edge.getAttribute('bpmnElement')
    if (id) edgeShapes.set(id, edge)
  }

  for (const process of all(document, 'process')) {
    const nodes = children(process).filter((element) => FLOW_NODE_NAMES.has(element.localName) && element.getAttribute('id'))
    if (!nodes.length) continue
    const laneByNode = new Map<string, Element>()
    const lanes = all(process, 'lane')
    for (const lane of lanes) {
      for (const reference of children(lane, 'flowNodeRef')) {
        const id = reference.textContent?.trim()
        if (id) laneByNode.set(id, lane)
      }
    }

    const graph = {
      id: `layout-${process.getAttribute('id') || 'process'}`,
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.spacing.nodeNodeBetweenLayers': '90',
        'elk.spacing.nodeNode': '70',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX'
      },
      children: nodes.map((node) => {
        const id = node.getAttribute('id')!
        const bounds = shapes.get(id) ? all(shapes.get(id)!, 'Bounds')[0] : undefined
        return {
          id,
          width: number(bounds?.getAttribute('width') ?? null, node.localName.endsWith('Event') ? 36 : node.localName.endsWith('Gateway') ? 50 : 120),
          height: number(bounds?.getAttribute('height') ?? null, node.localName.endsWith('Event') ? 36 : node.localName.endsWith('Gateway') ? 50 : 80)
        }
      }),
      edges: children(process, 'sequenceFlow').flatMap((flow) => {
        const id = flow.getAttribute('id')
        const source = flow.getAttribute('sourceRef')
        const target = flow.getAttribute('targetRef')
        return id && source && target && nodes.some((node) => node.getAttribute('id') === source) && nodes.some((node) => node.getAttribute('id') === target)
          ? [{ id, sources: [source], targets: [target] }]
          : []
      })
    }

    const result = await new ELK().layout(graph)
    const layoutNodes = new Map((result.children ?? []).map((node) => [node.id, node]))
    const laneBounds = new Map<string, { x: number; y: number; width: number; height: number }>()
    for (const lane of lanes) {
      const id = lane.getAttribute('id')
      const bounds = id && shapes.get(id) ? all(shapes.get(id)!, 'Bounds')[0] : undefined
      if (!id || !bounds) continue
      laneBounds.set(id, {
        x: number(bounds.getAttribute('x'), 0),
        y: number(bounds.getAttribute('y'), 0),
        width: number(bounds.getAttribute('width'), 1200),
        height: number(bounds.getAttribute('height'), 160)
      })
    }

    const minX = Math.min(...[...layoutNodes.values()].map((node) => node.x ?? 0))
    const baseX = laneBounds.size ? Math.min(...laneBounds.values().map((bounds) => bounds.x)) + 90 : 80
    const positions = new Map<string, { x: number; y: number; width: number; height: number }>()
    for (const node of nodes) {
      const id = node.getAttribute('id')!
      const laidOut = layoutNodes.get(id)
      const shape = shapes.get(id)
      const bounds = shape ? all(shape, 'Bounds')[0] : undefined
      if (!laidOut || !bounds) continue
      const width = number(bounds.getAttribute('width'), laidOut.width ?? 120)
      const height = number(bounds.getAttribute('height'), laidOut.height ?? 80)
      const lane = laneByNode.get(id)
      const laneBox = lane?.getAttribute('id') ? laneBounds.get(lane.getAttribute('id')!) : undefined
      const x = Math.round(baseX + (laidOut.x ?? 0) - minX)
      const y = Math.round(laneBox
        ? laneBox.y + Math.max(8, (laneBox.height - height) / 2)
        : 80 + (laidOut.y ?? 0))
      bounds.setAttribute('x', String(x))
      bounds.setAttribute('y', String(y))
      positions.set(id, { x, y, width, height })
    }

    const right = Math.max(...[...positions.values()].map((position) => position.x + position.width), baseX + 900) + 100
    for (const [id, bounds] of laneBounds) {
      const shapeBounds = all(shapes.get(id)!, 'Bounds')[0]
      if (shapeBounds) shapeBounds.setAttribute('width', String(Math.max(bounds.width, right - bounds.x)))
    }
    for (const participant of all(document, 'participant')) {
      if (participant.getAttribute('processRef') !== process.getAttribute('id')) continue
      const id = participant.getAttribute('id')
      const participantBounds = id && shapes.get(id) ? all(shapes.get(id)!, 'Bounds')[0] : undefined
      if (participantBounds) {
        const x = number(participantBounds.getAttribute('x'), 0)
        participantBounds.setAttribute('width', String(Math.max(number(participantBounds.getAttribute('width'), 0), right - x)))
      }
    }

    for (const flow of children(process, 'sequenceFlow')) {
      const edge = flow.getAttribute('id') ? edgeShapes.get(flow.getAttribute('id')!) : undefined
      const source = flow.getAttribute('sourceRef') ? positions.get(flow.getAttribute('sourceRef')!) : undefined
      const target = flow.getAttribute('targetRef') ? positions.get(flow.getAttribute('targetRef')!) : undefined
      if (!edge || !source || !target) continue
      for (const waypoint of children(edge).filter((item) => item.localName === 'waypoint')) waypoint.remove()
      const forward = target.x >= source.x
      const start = { x: forward ? source.x + source.width : source.x, y: source.y + source.height / 2 }
      const end = { x: forward ? target.x : target.x + target.width, y: target.y + target.height / 2 }
      const middleX = Math.round((start.x + end.x) / 2)
      const points = Math.abs(start.y - end.y) < 2
        ? [start, end]
        : [start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end]
      for (const point of points) {
        const waypoint = document.createElementNS(DI_NS, 'di:waypoint')
        waypoint.setAttribute('x', String(Math.round(point.x)))
        waypoint.setAttribute('y', String(Math.round(point.y)))
        const label = children(edge).find((item) => item.localName === 'BPMNLabel')
        edge.insertBefore(waypoint, label ?? null)
      }
    }
  }

  return new XMLSerializer().serializeToString(document)
}
