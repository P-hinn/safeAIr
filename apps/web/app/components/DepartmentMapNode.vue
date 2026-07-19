<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core'

interface DepartmentData {
  name: string
  count: number
  color: string
  initials: string
}

defineProps<NodeProps<DepartmentData>>()
</script>

<template>
  <section class="department-island" :style="{ '--department-color': data.color }">
    <header>
      <span>{{ data.initials }}</span>
      <div><strong>{{ data.name }}</strong><small>{{ data.count }} {{ data.count === 1 ? 'Prozess' : 'Prozesse' }}</small></div>
    </header>
  </section>
</template>

<style scoped>
.department-island { width: 100%; height: 100%; position: relative; border: 1px dashed color-mix(in srgb, var(--department-color) 38%, #cfd8e5); border-radius: 15px; background: color-mix(in srgb, var(--department-color) 4%, rgba(255,255,255,.92)); box-shadow: inset 0 0 0 1px rgba(255,255,255,.72); pointer-events: none; }
.department-island header { height: 41px; padding: 7px 11px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid color-mix(in srgb, var(--department-color) 14%, #e6ebf2); background: color-mix(in srgb, var(--department-color) 7%, rgba(255,255,255,.84)); border-radius: 15px 15px 0 0; }.department-island header > span { width: 25px; height: 25px; display: grid; place-items: center; border-radius: 7px; background: color-mix(in srgb, var(--department-color) 14%, #fff); color: var(--department-color); font-size: 6.2px; font-weight: 900; }.department-island header > div { display: flex; flex-direction: column; }.department-island strong { color: #17243a; font-size: 8.5px; }.department-island small { margin-top: 1px; color: #7d899a; font-size: 5.9px; }
</style>
