<script setup lang="ts">
import {
  ConnectionLineType,
  MarkerType,
  VueFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeDragEvent
} from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import type {
  BusinessProcess,
  ProcessStep,
  WorkflowNodeType,
  WorkflowPosition
} from '~/composables/useProcessMap'

const props = defineProps<{
  process: BusinessProcess
  selectedStepId?: string
  selectedEdgeId?: string
}>()

const emit = defineEmits<{
  selectStep: [id: string]
  selectEdge: [id: string]
  connect: [connection: { source: string; target: string; sourceHandle?: string | null }]
  move: [id: string, position: WorkflowPosition]
  removeEdge: [id: string]
  addNode: [type: WorkflowNodeType]
}>()

const palette: { type: WorkflowNodeType; label: string; hint: string }[] = [
  { type: 'trigger', label: 'Auslöser', hint: 'Startet den Workflow' },
  { type: 'task', label: 'Aufgabe', hint: 'Operativer Schritt' },
  { type: 'ai', label: 'KI-Schritt', hint: 'Modell oder Agent' },
  { type: 'decision', label: 'Entscheidung', hint: 'Ja-/Nein-Verzweigung' },
  { type: 'approval', label: 'Freigabe', hint: 'Human-in-the-Loop' },
  { type: 'end', label: 'Ende', hint: 'Schließt den Prozess' }
]

const nodes = computed<Node<ProcessStep>[]>(() => props.process.steps.map((step) => ({
  id: step.id,
  type: 'governance',
  position: step.position,
  data: step,
  selected: step.id === props.selectedStepId
})))

const edgeColor = (condition: string) => condition === 'yes' ? '#168a5b' : condition === 'no' ? '#d64242' : '#8a9aaf'

const edges = computed<Edge[]>(() => props.process.connections.map((connection) => ({
  id: connection.id,
  source: connection.source,
  target: connection.target,
  sourceHandle: connection.sourceHandle,
  type: 'smoothstep',
  label: connection.label,
  selected: connection.id === props.selectedEdgeId,
  animated: connection.condition === 'fallback',
  markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor(connection.condition), width: 17, height: 17 },
  style: { stroke: edgeColor(connection.condition), strokeWidth: connection.id === props.selectedEdgeId ? 2.6 : 1.7 },
  labelStyle: { fill: edgeColor(connection.condition), fontWeight: 700, fontSize: 9 },
  labelBgStyle: { fill: '#ffffff', fillOpacity: 0.94 },
  labelBgPadding: [5, 3],
  labelBgBorderRadius: 5
})))

function handleConnect(connection: Connection) {
  if (!connection.source || !connection.target) return
  emit('connect', {
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle
  })
}

function handleNodeDragStop(event: NodeDragEvent) {
  emit('move', event.node.id, event.node.position)
}

function handleEdgesDelete(edgesToDelete: Edge[]) {
  edgesToDelete.forEach((edge) => emit('removeEdge', edge.id))
}

function nodeColor(node: Node) {
  const colors: Record<string, string> = {
    trigger: '#168a5b', task: '#94a3b8', ai: '#7557d3', decision: '#d98212', approval: '#246bfd', end: '#d64242'
  }
  return colors[(node.data as ProcessStep)?.workflowType] ?? '#94a3b8'
}
</script>

<template>
  <div class="workflow-builder">
    <aside class="node-palette">
      <div class="palette-head"><span>Bausteine</span><small>Zum Canvas hinzufügen</small></div>
      <button v-for="item in palette" :key="item.type" class="palette-item" @click="emit('addNode', item.type)">
        <span class="palette-icon" :class="`palette-icon--${item.type}`">
          <svg v-if="item.type === 'trigger'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14l11-7z"/></svg>
          <svg v-else-if="item.type === 'ai'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 9h.01M15 9h.01M9 15c2 1.4 4 1.4 6 0M12 2v3M12 19v3"/></svg>
          <svg v-else-if="item.type === 'decision'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 9 9-9 9-9-9z"/></svg>
          <svg v-else-if="item.type === 'approval'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0M17 12l2 2 4-4"/></svg>
          <svg v-else-if="item.type === 'end'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5"/></svg>
        </span>
        <span><strong>{{ item.label }}</strong><small>{{ item.hint }}</small></span>
        <i>+</i>
      </button>
      <div class="palette-help">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
        <span>Verbinde Bausteine über die Punkte an den Seiten.</span>
      </div>
    </aside>

    <div class="flow-canvas">
      <VueFlow
        :key="process.id"
        :nodes="nodes"
        :edges="edges"
        :connection-line-type="ConnectionLineType.SmoothStep"
        :min-zoom="0.35"
        :max-zoom="1.8"
        :fit-view-on-init="true"
        :fit-view-on-init-options="{ padding: 0.18, maxZoom: 1 }"
        :elevate-edges-on-select="true"
        :snap-to-grid="true"
        :snap-grid="[15, 15]"
        class="safair-flow"
        @connect="handleConnect"
        @node-click="emit('selectStep', $event.node.id)"
        @edge-click="emit('selectEdge', $event.edge.id)"
        @node-drag-stop="handleNodeDragStop"
        @edges-delete="handleEdgesDelete"
      >
        <template #node-governance="nodeProps">
          <WorkflowNode v-bind="nodeProps" />
        </template>
        <Background pattern-color="#dfe6ef" :gap="18" :size="1" />
        <MiniMap :node-color="nodeColor" :pannable="true" :zoomable="true" position="bottom-right" />
        <Controls position="bottom-left" />
        <div class="canvas-tip">Scrollen zum Zoomen · Ziehen zum Verschieben · Knoten anklicken zum Bearbeiten</div>
      </VueFlow>
    </div>
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';
@import '@vue-flow/minimap/dist/style.css';

.workflow-builder { height: 620px; min-height: 500px; display: grid; grid-template-columns: 205px minmax(0, 1fr); background: #f8fafc; }
.node-palette { z-index: 3; padding: 16px 12px; border-right: 1px solid var(--border-strong); background: #fff; overflow-y: auto; }
.palette-head { padding: 2px 5px 13px; display: flex; flex-direction: column; }.palette-head span { color: var(--text); font-size: 11px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; }.palette-head small { margin-top: 4px; color: var(--muted); font-size: 10px; }
.palette-item { width: 100%; min-height: 49px; padding: 6px 7px; display: flex; align-items: center; justify-content: flex-start; gap: 8px; border-color: transparent; background: transparent; color: var(--text); text-align: left; }
.palette-item:hover { border-color: var(--border); background: var(--surface-soft); color: var(--text); transform: none; }
.palette-icon { width: 28px; height: 28px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 7px; background: #f0f3f7; color: #64748b; }.palette-icon svg { width: 15px; }.palette-icon--trigger { color: var(--ok); background: var(--ok-soft); }.palette-icon--ai { color: var(--purple); background: var(--purple-soft); }.palette-icon--decision { color: var(--warn); background: var(--warn-soft); }.palette-icon--approval { color: var(--accent); background: var(--accent-soft); }.palette-icon--end { color: var(--err); background: var(--err-soft); }
.palette-item > span:nth-child(2) { min-width: 0; display: flex; flex: 1; flex-direction: column; }.palette-item strong { font-size: 11px; }.palette-item small { margin-top: 2px; color: var(--muted); font-size: 9.5px; }.palette-item > i { width: 19px; height: 19px; display: grid; place-items: center; border-radius: 5px; background: #eef2f7; color: var(--muted); font-size: 12px; font-style: normal; }
.palette-help { margin: 16px 5px 0; padding: 11px; display: flex; gap: 8px; border: 1px solid var(--blue); border-radius: 8px; background: var(--accent-soft); color: #354dcc; }.palette-help svg { width: 14px; flex: 0 0 auto; }.palette-help span { font-size: 9.5px; line-height: 1.5; }
.flow-canvas { min-width: 0; position: relative; }
.safair-flow { width: 100%; height: 100%; background: #f8fafc; }
.safair-flow .vue-flow__node { border: 0; padding: 0; background: transparent; width: auto; box-shadow: none; }
.safair-flow .vue-flow__node.selected { box-shadow: none; }
.safair-flow .vue-flow__edge.selected .vue-flow__edge-path { filter: drop-shadow(0 1px 2px rgba(36,107,253,.25)); }
.safair-flow .vue-flow__edge-label { font-family: 'DM Sans', sans-serif; }
.safair-flow .vue-flow__controls { overflow: hidden; border: 1px solid var(--border); border-radius: 8px; box-shadow: var(--shadow-sm); }
.safair-flow .vue-flow__controls-button { width: 27px; height: 27px; border-color: var(--border); color: var(--text); background: #fff; }
.safair-flow .vue-flow__minimap { width: 125px; height: 78px; overflow: hidden; border: 1px solid var(--border); border-radius: 8px; background: rgba(255,255,255,.9); box-shadow: var(--shadow-sm); }
.canvas-tip { position: absolute; z-index: 4; top: 12px; left: 50%; padding: 7px 10px; border: 1px solid var(--border-strong); border-radius: 7px; transform: translateX(-50%); background: rgba(255,254,249,.96); color: #55544e; font-size: 10px; box-shadow: var(--shadow-sm); pointer-events: none; white-space: nowrap; }

@media (max-width: 800px) {
  .workflow-builder { height: 620px; grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
  .node-palette { padding: 8px; display: flex; gap: 5px; border-right: 0; border-bottom: 1px solid var(--border); overflow-x: auto; }
  .palette-head, .palette-help { display: none; }.palette-item { width: auto; min-width: 105px; min-height: 42px; flex: 0 0 auto; }.palette-item small, .palette-item > i { display: none; }
  .canvas-tip { display: none; }
}
.workflow-builder, .safair-flow { background: var(--paper); }
.node-palette { border-right-color: var(--border-strong); background: var(--surface); }
.palette-icon, .palette-item > span:nth-child(2), .palette-help, .safair-flow .vue-flow__controls, .safair-flow .vue-flow__minimap, .canvas-tip { border-radius: 0; }
.palette-icon { border: 1px solid currentColor; background: transparent; }
.safair-flow .vue-flow__controls, .safair-flow .vue-flow__minimap { border-color: var(--ink); box-shadow: none; }
</style>
