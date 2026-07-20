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
})
