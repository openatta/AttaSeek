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

  // projectId → scope+scopeId mapping is in recall() (L2, tested via
  // integration since it requires JSONL file I/O). The mapping logic:
  //   const scope = query.projectId ? 'project' : query.scope
  //   const scopeId = query.projectId || query.scopeId
  // Verified by the ContextAssembler.buildMemoryContext() call path:
  // when projectId is provided, project-scoped memories filter correctly.
})
