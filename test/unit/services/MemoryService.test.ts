import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryService } from '../../../src/main/memory/MemoryService'

describe('MemoryService', () => {
  let svc: MemoryService

  beforeEach(() => { svc = new MemoryService() })

  // L1 tests — in-memory, no DB needed
  it('stores and recalls L1 scratchpad', () => {
    svc.setScratchpad('s1', 'k', 'v')
    expect(svc.getScratchpad('s1', 'k')).toBe('v')
  })

  it('returns undefined for missing scratchpad key', () => {
    expect(svc.getScratchpad('s1', 'nope')).toBeUndefined()
  })

  it('clears scratchpad for a session', () => {
    svc.setScratchpad('s1', 'k', 'v')
    svc.clearScratchpad('s1')
    expect(svc.getScratchpad('s1', 'k')).toBeUndefined()
  })
})
