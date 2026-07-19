<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import type { ProcessStep } from '~/composables/useProcessMap'

const props = defineProps<NodeProps<ProcessStep>>()
const { findTool } = useProcessMap()

const typeLabel: Record<string, string> = {
  trigger: 'Auslöser',
  task: 'Aufgabe',
  ai: 'KI-Verarbeitung',
  decision: 'Entscheidung',
  approval: 'Freigabe',
  end: 'Prozessende'
}

const riskLabel: Record<string, string> = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch' }
</script>

<template>
  <article class="workflow-node" :class="[`workflow-node--${data.workflowType}`, { 'workflow-node--selected': props.selected }]">
    <Handle v-if="data.workflowType !== 'trigger'" type="target" :position="Position.Left" class="node-handle node-handle--target" />

    <div class="node-header">
      <span class="node-type-icon">
        <svg v-if="data.workflowType === 'trigger'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14l11-7z"/></svg>
        <svg v-else-if="data.workflowType === 'ai'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 9h.01M15 9h.01M9 15c2 1.4 4 1.4 6 0M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
        <svg v-else-if="data.workflowType === 'decision'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 9 9-9 9-9-9z"/><path d="M12 8v5M12 16h.01"/></svg>
        <svg v-else-if="data.workflowType === 'approval'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0M17 12l2 2 4-4"/></svg>
        <svg v-else-if="data.workflowType === 'end'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5"/></svg>
      </span>
      <span class="node-type">{{ typeLabel[data.workflowType] }}</span>
      <span class="node-risk" :class="`node-risk--${data.risk}`">{{ riskLabel[data.risk] }}</span>
    </div>

    <div class="node-body">
      <span class="node-department">{{ data.department }}</span>
      <strong>{{ data.title }}</strong>
      <p>{{ data.description }}</p>
    </div>

    <div class="node-footer">
      <div v-if="data.toolIds.length" class="node-tools">
        <span
          v-for="toolId in data.toolIds.slice(0, 3)"
          :key="toolId"
          :style="{ background: findTool(toolId)?.color }"
          :title="findTool(toolId)?.name"
        >{{ findTool(toolId)?.initials }}</span>
        <i v-if="data.toolIds.length > 3">+{{ data.toolIds.length - 3 }}</i>
      </div>
      <span v-else class="node-no-tools">Keine Tools</span>
      <span v-if="data.humanApproval" class="human-control" title="Manuelle Freigabe erforderlich">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 12 3 3 7-7"/><circle cx="12" cy="12" r="9"/></svg>
        Human
      </span>
    </div>

    <template v-if="data.workflowType === 'decision'">
      <span class="handle-label handle-label--yes">Ja</span>
      <Handle id="yes" type="source" :position="Position.Right" class="node-handle node-handle--yes" />
      <span class="handle-label handle-label--no">Nein</span>
      <Handle id="no" type="source" :position="Position.Right" class="node-handle node-handle--no" />
    </template>
    <Handle v-else-if="data.workflowType !== 'end'" type="source" :position="Position.Right" class="node-handle node-handle--source" />
  </article>
</template>

<style scoped>
.workflow-node {
  width: 238px;
  min-height: 164px;
  position: relative;
  overflow: visible;
  border: 1px solid rgba(23,23,20,.34);
  border-top: 3px solid #94a3b8;
  border-radius: 0;
  background: var(--surface);
  color: #142238;
  box-shadow: none;
  transition: border-color 140ms, box-shadow 140ms, transform 140ms;
}
.workflow-node:hover { border-color: var(--ink); box-shadow: 6px 6px 0 rgba(23,23,20,.1); }
.workflow-node--selected { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(92,118,255,.14); }
.workflow-node--trigger { border-top-color: #168a5b; }.workflow-node--ai { border-top-color: #7557d3; }.workflow-node--decision { border-top-color: #d98212; }.workflow-node--approval { border-top-color: #246bfd; }.workflow-node--end { border-top-color: #d64242; }
.node-header { height: 38px; padding: 0 11px; display: flex; align-items: center; gap: 7px; border-bottom: 1px solid #edf0f4; }
.node-type-icon { width: 22px; height: 22px; display: grid; place-items: center; border: 1px solid currentColor; border-radius: 0; background: transparent; color: var(--muted); }
.workflow-node--trigger .node-type-icon { color: #168a5b; background: #eaf8f1; }.workflow-node--ai .node-type-icon { color: #7557d3; background: #f1edff; }.workflow-node--decision .node-type-icon { color: #d98212; background: #fff5e5; }.workflow-node--approval .node-type-icon { color: #246bfd; background: #edf3ff; }.workflow-node--end .node-type-icon { color: #d64242; background: #fff0f0; }
.node-type-icon svg { width: 13px; }
.node-type { color: #575750; font-size: 9.5px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; }
.node-risk { margin-left: auto; padding: 3px 6px; border-radius: 99px; font-size: 8.5px; font-weight: 800; }.node-risk--low { color: #168a5b; background: #eaf8f1; }.node-risk--medium { color: #d98212; background: #fff5e5; }.node-risk--high { color: #d64242; background: #fff0f0; }
.node-body { min-height: 76px; padding: 11px 12px 8px; }
.node-department { display: block; overflow: hidden; color: #354dcc; font-size: 9px; font-weight: 800; letter-spacing: .4px; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
.node-body strong { margin-top: 5px; display: block; overflow: hidden; font-family: 'Space Grotesk', sans-serif; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.node-body p { margin: 6px 0 0; display: -webkit-box; overflow: hidden; color: #575750; font-size: 10px; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.node-footer { min-height: 35px; padding: 6px 11px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #edf0f4; }
.node-tools { display: flex; padding-left: 3px; }.node-tools > span, .node-tools > i { width: 21px; height: 21px; margin-left: -3px; display: grid; place-items: center; border: 2px solid #fff; border-radius: 6px; color: #fff; font-size: 5.8px; font-style: normal; font-weight: 800; }.node-tools > i { background: #e9edf3; color: #69778c; }
.node-no-tools { color: #696861; font-size: 9.5px; }
.human-control { display: flex; align-items: center; gap: 3px; color: #354dcc; font-size: 9px; font-weight: 700; }.human-control svg { width: 12px; }
.node-handle { width: 11px; height: 11px; border: 2px solid #fff; background: #77869b; box-shadow: 0 0 0 1px #aeb9c8; }
.node-handle--target { left: -6px; }.node-handle--source { right: -6px; }
.node-handle--yes { top: 46%; right: -6px; background: #168a5b; box-shadow: 0 0 0 1px #168a5b; }.node-handle--no { top: 76%; right: -6px; background: #d64242; box-shadow: 0 0 0 1px #d64242; }
.handle-label { position: absolute; right: 9px; z-index: 2; padding: 1px 3px; border-radius: 3px; font-size: 6px; font-weight: 800; pointer-events: none; }.handle-label--yes { top: calc(46% - 5px); color: #168a5b; background: #eaf8f1; }.handle-label--no { top: calc(76% - 5px); color: #d64242; background: #fff0f0; }
</style>
