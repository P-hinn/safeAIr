import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('ProcessLandscape library styles', () => {
  it('loads Vue Flow positioning rules outside scoped CSS', () => {
    const source = readFileSync(new URL('../app/components/ProcessLandscape.vue', import.meta.url), 'utf8')
    const globalStyle = source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
    const scopedStyle = source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? ''

    expect(globalStyle).toContain("@import '@vue-flow/core/dist/style.css'")
    expect(globalStyle).toContain("@import '@vue-flow/controls/dist/style.css'")
    expect(globalStyle).toContain("@import '@vue-flow/minimap/dist/style.css'")
    expect(scopedStyle).not.toContain('@vue-flow/core/dist/style.css')
  })

  it('keeps connections visible while semantic zoom hides process cards', () => {
    const source = readFileSync(new URL('../app/components/ProcessLandscape.vue', import.meta.url), 'utf8')

    expect(source).toContain("const showConnections = ref(true)")
    expect(source).toContain("const showPortfolioKpis = ref(false)")
    expect(source).toContain("@viewport-change=\"handleViewportChange\"")
    expect(source).toContain('.map-shell--domains .landscape-flow :deep(.vue-flow__node-landscapeProcess) { opacity: 0;')
    expect(source).toContain('.map-shell--domains .landscape-flow :deep(.vue-flow__edge-path) { stroke-width: 3px !important; opacity: .92 !important; }')
  })
})
