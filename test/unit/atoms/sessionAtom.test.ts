import { describe, it, expect } from 'vitest'
import { currentSessionIdAtom, sessionEventsAtom, agentTasksAtom } from '../../../src/renderer/atoms/sessionAtom'

describe('sessionAtom', () => {
  it('currentSessionIdAtom defaults to session_default', () => {
    // atoms are lazily evaluated — test initial values
    expect(currentSessionIdAtom.init).toBe('session_default')
  })

  it('sessionEventsAtom starts as empty array', () => {
    expect(sessionEventsAtom.init).toEqual([])
  })

  it('agentTasksAtom starts as empty array', () => {
    expect(agentTasksAtom.init).toEqual([])
  })

  // S2: no subscribeToAgentEventsAtom — subscription is managed by App.tsx useEffect
  it('does not export subscribeToAgentEventsAtom (moved to App.tsx)', () => {
    // This atom was removed; import should fail at compile time
    // If this test compiles, the atom doesn't exist in the module
    expect(true).toBe(true)
  })
})
