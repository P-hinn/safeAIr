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
.department-island { width: 100%; height: 100%; position: relative; border: 1px dashed color-mix(in srgb, var(--department-color) 52%, #817f77); border-radius: 0; background: color-mix(in srgb, var(--department-color) 3%, rgba(248,246,239,.9)); box-shadow: none; pointer-events: none; }
.department-island header { height: 41px; padding: 7px 11px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid color-mix(in srgb, var(--department-color) 20%, rgba(23,23,20,.14)); background: color-mix(in srgb, var(--department-color) 5%, rgba(241,239,232,.9)); border-radius: 0; }.department-island header > span { width: 25px; height: 25px; display: grid; place-items: center; border: 1px solid var(--department-color); border-radius: 0; background: transparent; color: var(--department-color); font-size: 6.2px; font-weight: 900; }.department-island header > div { display: flex; flex-direction: column; }.department-island strong { color: #171714; font-size: 8.5px; }.department-island small { margin-top: 1px; color: #77756e; font-size: 5.9px; }
</style>
