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
.map-layer { width: 100%; height: 100%; padding: 10px 13px; display: flex; align-items: flex-start; gap: 8px; border: 1px solid #e0e6ee; border-radius: 17px; background: rgba(245,247,250,.62); pointer-events: none; }.map-layer > span { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 7px; background: #e8ecf2; color: #6f7d90; font-size: 6.7px; font-weight: 900; }.map-layer > div { display: flex; flex-direction: column; }.map-layer strong { color: #344158; font-size: 8.2px; }.map-layer small { margin-top: 1px; color: #8995a6; font-size: 5.8px; }.map-layer--management { border-color: #e2dafb; background: rgba(247,244,255,.62); }.map-layer--management > span { color: #7557d3; background: #eae4ff; }.map-layer--core { border-color: #d7e3fb; background: rgba(244,248,255,.66); }.map-layer--core > span { color: #246bfd; background: #e0eaff; }.map-layer--support { border-color: #d8ece3; background: rgba(244,251,247,.64); }.map-layer--support > span { color: #168a5b; background: #dff4e9; }
</style>
