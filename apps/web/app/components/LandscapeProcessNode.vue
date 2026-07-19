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
.landscape-node { width: 248px; min-height: 124px; padding: 10px 11px 9px; position: relative; overflow: visible; border: 1px solid rgba(23,23,20,.42); border-top: 3px solid #8d8b84; border-radius: 0; background: #fffef9; color: #171714; box-shadow: 3px 3px 0 rgba(23,23,20,.08); transition: 150ms; }
.landscape-node:hover { border-color: #171714; box-shadow: 7px 7px 0 rgba(23,23,20,.1); transform: translate(-2px,-2px); }.landscape-node--selected { border-color: #5c76ff; box-shadow: 0 0 0 3px rgba(92,118,255,.16); }.landscape-node--active { border-top-color: #168a5b; }.landscape-node--pilot { border-top-color: #d98212; }
.landscape-node header { display: flex; justify-content: space-between; gap: 8px; }.layer-badge, .node-status { padding: 3px 6px; border-radius: 999px; font-size: 8px; font-weight: 800; }.layer-badge { color: #546171; background: #e8ebee; text-transform: uppercase; }.layer-badge--management { color: #6544c2; background: #eee9ff; }.layer-badge--core { color: #354dcc; background: #e8edff; }.layer-badge--support { color: #0f7049; background: #e2f4eb; }.node-status { display: flex; align-items: center; gap: 4px; color: #596473; background: #e8eaed; }.node-status i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }.node-status--active { color: #0f7049; background: #e2f4eb; }.node-status--pilot { color: #a85f05; background: #f9ecd6; }
.landscape-node > strong { margin-top: 8px; display: block; overflow: hidden; font-family: 'Space Grotesk', sans-serif; font-size: 12.5px; text-overflow: ellipsis; white-space: nowrap; }.node-owner { margin-top: 3px; display: block; overflow: hidden; color: #575750; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.node-departments { min-height: 23px; margin-top: 7px; display: flex; align-items: flex-start; flex-wrap: wrap; gap: 3px; }.node-departments span { padding: 2px 5px; border: 1px solid rgba(23,23,20,.22); border-radius: 0; background: #e5e2d9; color: #494842; font-size: 7.5px; }.node-departments--empty { color: #6d6b64; font-size: 8px; }
.landscape-node footer { margin-top: 4px; padding-top: 7px; display: flex; align-items: center; gap: 7px; border-top: 1px solid rgba(23,23,20,.2); }.landscape-node footer > span { display: flex; align-items: baseline; gap: 2px; }.landscape-node footer b { font-size: 9px; }.landscape-node footer b.risk { color: #d64242; }.landscape-node footer small { color: #66655e; font-size: 7px; }.landscape-node footer > i { margin-left: auto; color: #354dcc; font-size: 8px; font-style: normal; font-weight: 750; }
.map-handle { width: 8px; height: 8px; border: 2px solid #fff; background: #7f90a7; opacity: 0; pointer-events: none; }.map-handle--left { left: -5px; }.map-handle--right { right: -5px; }.map-handle--top { top: -5px; }.map-handle--bottom { bottom: -5px; }
</style>
