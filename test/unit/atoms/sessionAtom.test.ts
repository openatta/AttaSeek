import { describe, it, expect } from 'vitest'
import { currentSessionIdAtom, sessionEventsAtom, agentTasksAtom } from '../../../src/renderer/atoms/sessionAtom'

describe('sessionAtom', () => {
  it('currentSessionIdAtom is a readable atom (derived from active activity)', () => {
    // Derived atoms don't have .init — they compute from dependencies
    expect(currentSessionIdAtom).toBeDefined()
    expect(typeof currentSessionIdAtom.read).toBe('function')
  })

  it('sessionEventsAtom starts as empty array', () => {
    expect(sessionEventsAtom.init).toEqual([])
  })

  it('agentTasksAtom starts as empty array', () => {
    expect(agentTasksAtom.init).toEqual([])
  })

  it('exports atoms needed by the event bridge', () => {
    expect(currentSessionIdAtom).toBeDefined()
    expect(sessionEventsAtom).toBeDefined()
    expect(agentTasksAtom).toBeDefined()
  })
})
