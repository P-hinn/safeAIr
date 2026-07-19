<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import type { BusinessProcess } from '~/composables/useProcessMap'

interface LandscapeProcessData {
  process: BusinessProcess
  coverage: number
  highRisks: number
  incoming: number
  outgoing: number
  departments: string[]
}

const props = defineProps<NodeProps<LandscapeProcessData>>()
const statusLabel = (status: string) => status === 'active' ? 'Produktiv' : status === 'pilot' ? 'Pilot' : 'Geplant'
const layerLabel = (layer: string) => layer === 'management' ? 'Steuerung' : layer === 'core' ? 'Kernprozess' : 'Unterstützung'
</script>

<template>
  <article class="landscape-node" :class="[`landscape-node--${data.process.status}`, { 'landscape-node--selected': props.selected }]">
    <Handle id="target-left" type="target" :position="Position.Left" class="map-handle map-handle--left" />
    <Handle id="target-top" type="target" :position="Position.Top" class="map-handle map-handle--top" />
    <Handle id="target-bottom" type="target" :position="Position.Bottom" class="map-handle map-handle--bottom" />
    <Handle id="target-right" type="target" :position="Position.Right" class="map-handle map-handle--right" />
    <Handle id="source-left" type="source" :position="Position.Left" class="map-handle map-handle--left" />
    <Handle id="source-top" type="source" :position="Position.Top" class="map-handle map-handle--top" />
    <Handle id="source-bottom" type="source" :position="Position.Bottom" class="map-handle map-handle--bottom" />
    <Handle id="source-right" type="source" :position="Position.Right" class="map-handle map-handle--right" />

    <header>
      <span class="layer-badge" :class="`layer-badge--${data.process.landscapeLayer}`">{{ layerLabel(data.process.landscapeLayer) }}</span>
      <span class="node-status" :class="`node-status--${data.process.status}`"><i />{{ statusLabel(data.process.status) }}</span>
    </header>
    <strong>{{ data.process.name }}</strong>
    <span class="node-owner">{{ data.process.owner }}</span>

    <div v-if="data.departments.length" class="node-departments">
      <span v-for="department in data.departments.slice(0, 2)" :key="department">{{ department }}</span>
      <span v-if="data.departments.length > 2">+{{ data.departments.length - 2 }}</span>
    </div>
    <div v-else class="node-departments node-departments--empty">Keine weiteren Fachbereiche</div>

    <footer>
      <span><b>{{ data.coverage }}%</b><small>AI</small></span>
      <span><b :class="{ risk: data.highRisks > 1 }">{{ data.highRisks }}</b><small>Risiken</small></span>
      <span><b>{{ data.incoming }}</b><small>rein</small></span>
      <span><b>{{ data.outgoing }}</b><small>raus</small></span>
      <i>Öffnen →</i>
    </footer>
  </article>
</template>

<style scoped>
.landscape-node { width: 238px; min-height: 112px; padding: 9px 10px 8px; position: relative; overflow: visible; border: 1px solid #d9e1ec; border-left: 4px solid #9aa8ba; border-radius: 10px; background: #fff; color: #17243a; box-shadow: 0 5px 14px rgba(20,34,56,.09); transition: 150ms; }
.landscape-node:hover { border-color: #9fb2cd; box-shadow: 0 11px 26px rgba(20,34,56,.15); transform: translateY(-2px); }.landscape-node--selected { border-color: #246bfd; box-shadow: 0 0 0 3px rgba(36,107,253,.14), 0 12px 28px rgba(20,34,56,.15); }.landscape-node--active { border-left-color: #168a5b; }.landscape-node--pilot { border-left-color: #d98212; }
.landscape-node header { display: flex; justify-content: space-between; gap: 8px; }.layer-badge, .node-status { padding: 3px 6px; border-radius: 999px; font-size: 6px; font-weight: 800; }.layer-badge { color: #64748b; background: #eff2f6; text-transform: uppercase; }.layer-badge--management { color: #7557d3; background: #f1edff; }.layer-badge--core { color: #246bfd; background: #edf3ff; }.layer-badge--support { color: #168a5b; background: #eaf8f1; }.node-status { display: flex; align-items: center; gap: 4px; color: #7c899b; background: #f0f2f5; }.node-status i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }.node-status--active { color: #168a5b; background: #eaf8f1; }.node-status--pilot { color: #d98212; background: #fff5e5; }
.landscape-node > strong { margin-top: 7px; display: block; overflow: hidden; font-family: 'Manrope', sans-serif; font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap; }.node-owner { margin-top: 2px; display: block; overflow: hidden; color: #69778c; font-size: 6.8px; text-overflow: ellipsis; white-space: nowrap; }
.node-departments { min-height: 21px; margin-top: 6px; display: flex; align-items: flex-start; flex-wrap: wrap; gap: 3px; }.node-departments span { padding: 2px 5px; border-radius: 5px; background: #eef1f5; color: #5b697c; font-size: 5.5px; }.node-departments--empty { color: #9aa5b4; font-size: 5.8px; }
.landscape-node footer { margin-top: 3px; padding-top: 6px; display: flex; align-items: center; gap: 7px; border-top: 1px solid #edf0f4; }.landscape-node footer > span { display: flex; align-items: baseline; gap: 2px; }.landscape-node footer b { font-size: 7.5px; }.landscape-node footer b.risk { color: #d64242; }.landscape-node footer small { color: #95a1b3; font-size: 5.2px; }.landscape-node footer > i { margin-left: auto; color: #246bfd; font-size: 6px; font-style: normal; font-weight: 700; }
.map-handle { width: 8px; height: 8px; border: 2px solid #fff; background: #7f90a7; opacity: 0; pointer-events: none; }.map-handle--left { left: -5px; }.map-handle--right { right: -5px; }.map-handle--top { top: -5px; }.map-handle--bottom { bottom: -5px; }
</style>
