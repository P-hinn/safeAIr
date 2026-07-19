<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core'

interface LayerData {
  id: string
  name: string
  hint: string
  number: string
}

defineProps<NodeProps<LayerData>>()
</script>

<template>
  <section class="map-layer" :class="`map-layer--${data.id}`">
    <span>{{ data.number }}</span>
    <div><strong>{{ data.name }}</strong><small>{{ data.hint }}</small></div>
  </section>
</template>

<style scoped>
.map-layer { width: 100%; height: 100%; padding: 12px 14px; display: flex; align-items: flex-start; gap: 9px; border: 1px solid rgba(23,23,20,.32); border-radius: 0; background: rgba(232,229,220,.78); pointer-events: none; }.map-layer > span { width: 28px; height: 28px; display: grid; place-items: center; border: 1px solid currentColor; border-radius: 0; background: rgba(255,255,255,.42); color: #575750; font-size: 9px; font-weight: 900; }.map-layer > div { display: flex; flex-direction: column; }.map-layer strong { color: #171714; font-size: 11px; }.map-layer small { margin-top: 2px; color: #5f5e57; font-size: 8.5px; }.map-layer--management { border-color: rgba(117,87,211,.45); background: rgba(117,87,211,.07); }.map-layer--management > span { color: #6544c2; }.map-layer--core { border-color: rgba(92,118,255,.44); background: rgba(92,118,255,.075); }.map-layer--core > span { color: #354dcc; }.map-layer--support { border-color: rgba(22,138,91,.42); background: rgba(22,138,91,.065); }.map-layer--support > span { color: #0f7049; }
</style>
