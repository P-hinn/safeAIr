<script setup lang="ts">
import type { NodeProps } from '@vue-flow/core'

interface DepartmentLabelData {
  name: string
  count: number
  color: string
  initials: string
}

defineProps<NodeProps<DepartmentLabelData>>()
</script>

<template>
  <div class="department-map-label" :style="{ '--department-color': data.color }">
    <span>{{ data.initials }}</span>
    <div>
      <strong>{{ data.name }}</strong>
      <small>{{ data.count }} {{ data.count === 1 ? 'Prozess' : 'Prozesse' }}</small>
    </div>
  </div>
</template>

<style scoped>
.department-map-label { width: max-content; max-width: 190px; padding: 9px 12px; display: flex; align-items: center; gap: 9px; border: 1px solid var(--department-color); background: color-mix(in srgb, var(--department-color) 8%, rgba(255,254,249,.96)); box-shadow: 3px 3px 0 rgba(23,23,20,.1); color: #171714; pointer-events: none; transform: translate(-50%, -50%) scale(var(--semantic-label-scale, 1.7)); transform-origin: center; }
.department-map-label > span { width: 29px; height: 29px; flex: 0 0 auto; display: grid; place-items: center; border: 1px solid var(--department-color); background: rgba(255,255,255,.66); color: var(--department-color); font-size: 8.5px; font-weight: 900; }
.department-map-label > div { min-width: 0; display: flex; flex-direction: column; }.department-map-label strong { overflow: hidden; font-size: 11px; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }.department-map-label small { margin-top: 2px; color: #5f5e57; font-size: 8px; }
</style>
