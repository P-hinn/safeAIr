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
.department-island { width: 100%; height: 100%; position: relative; border: 1px dashed color-mix(in srgb, var(--department-color) 64%, #6f6d66); border-radius: 0; background: color-mix(in srgb, var(--department-color) 5%, rgba(248,246,239,.94)); box-shadow: none; pointer-events: none; }
.department-island header { height: 48px; padding: 8px 12px; display: flex; align-items: center; gap: 9px; border-bottom: 1px solid color-mix(in srgb, var(--department-color) 28%, rgba(23,23,20,.2)); background: color-mix(in srgb, var(--department-color) 9%, rgba(232,229,220,.94)); border-radius: 0; }.department-island header > span { width: 29px; height: 29px; display: grid; place-items: center; border: 1px solid var(--department-color); border-radius: 0; background: rgba(255,255,255,.48); color: var(--department-color); font-size: 8.5px; font-weight: 900; }.department-island header > div { display: flex; flex-direction: column; }.department-island strong { color: #171714; font-size: 11px; }.department-island small { margin-top: 2px; color: #5f5e57; font-size: 8.5px; }
</style>
