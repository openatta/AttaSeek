import { describe, it, expect } from 'vitest'
import { createStore } from 'jotai'
import { outputAreaVisibleAtom } from '@/atoms/outputTabsAtom'

describe('outputAreaVisibleAtom', () => {
  it('should default to false (output area closed by default)', () => {
    const store = createStore()
    const visible = store.get(outputAreaVisibleAtom)
    expect(visible).toBe(false)
  })
})
