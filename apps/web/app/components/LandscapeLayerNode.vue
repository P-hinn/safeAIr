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
.map-layer { width: 100%; height: 100%; padding: 10px 13px; display: flex; align-items: flex-start; gap: 8px; border: 1px solid rgba(23,23,20,.2); border-radius: 0; background: rgba(241,239,232,.7); pointer-events: none; }.map-layer > span { width: 24px; height: 24px; display: grid; place-items: center; border: 1px solid currentColor; border-radius: 0; background: transparent; color: #6f6d66; font-size: 6.7px; font-weight: 900; }.map-layer > div { display: flex; flex-direction: column; }.map-layer strong { color: #171714; font-size: 8.2px; }.map-layer small { margin-top: 1px; color: #77756e; font-size: 5.8px; }.map-layer--management { border-color: rgba(117,87,211,.35); background: rgba(117,87,211,.04); }.map-layer--management > span { color: #7557d3; background: transparent; }.map-layer--core { border-color: rgba(92,118,255,.34); background: rgba(92,118,255,.045); }.map-layer--core > span { color: #5c76ff; background: transparent; }.map-layer--support { border-color: rgba(22,138,91,.3); background: rgba(22,138,91,.035); }.map-layer--support > span { color: #168a5b; background: transparent; }
</style>
