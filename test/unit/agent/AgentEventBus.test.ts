import { describe, it, expect, beforeEach } from 'vitest'
import { AgentEventBus } from '../../../src/main/agent/AgentEventBus'
import type { SessionEvent } from '../../../src/renderer/core/types/SessionEvent'

function makeEvent(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    id: 'evt_1',
    sessionId: 's1',
    taskId: 't1',
    type: 'UserMessage',
    payload: { content: 'hello' },
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('AgentEventBus', () => {
  let bus: AgentEventBus

  beforeEach(() => {
    bus = new AgentEventBus()
  })

  it('emits events to session subscribers', () => {
    const received: SessionEvent[] = []
    bus.subscribe('s1', (e) => received.push(e))
    bus.emit(makeEvent({ sessionId: 's1' }))
    expect(received).toHaveLength(1)
    expect(received[0].sessionId).toBe('s1')
  })

  it('emits events to global subscribers (*)', () => {
    const received: SessionEvent[] = []
    bus.subscribe('*', (e) => received.push(e))
    bus.emit(makeEvent({ sessionId: 's2' }))
    bus.emit(makeEvent({ sessionId: 's3' }))
    expect(received).toHaveLength(2)
  })

  it('does not emit to other session subscribers', () => {
    const s1Events: SessionEvent[] = []
    const s2Events: SessionEvent[] = []
    bus.subscribe('s1', (e) => s1Events.push(e))
    bus.subscribe('s2', (e) => s2Events.push(e))
    bus.emit(makeEvent({ sessionId: 's1' }))
    expect(s1Events).toHaveLength(1)
    expect(s2Events).toHaveLength(0)
  })

  it('returns unsubscribe function', () => {
    const received: SessionEvent[] = []
    const unsub = bus.subscribe('s1', (e) => received.push(e))
    bus.emit(makeEvent({ sessionId: 's1' }))
    expect(received).toHaveLength(1)
    unsub()
    bus.emit(makeEvent({ sessionId: 's1' }))
    expect(received).toHaveLength(1) // still 1
  })

  it('stores event history per session', () => {
    bus.emit(makeEvent({ sessionId: 's1', type: 'UserMessage' }))
    bus.emit(makeEvent({ sessionId: 's1', type: 'AgentMessage' }))
    bus.emit(makeEvent({ sessionId: 's2', type: 'UserMessage' }))

    expect(bus.getHistory('s1')).toHaveLength(2)
    expect(bus.getHistory('s2')).toHaveLength(1)
  })

  it('filters history by event type', () => {
    bus.emit(makeEvent({ sessionId: 's1', type: 'UserMessage' }))
    bus.emit(makeEvent({ sessionId: 's1', type: 'AgentMessage' }))
    bus.emit(makeEvent({ sessionId: 's1', type: 'ToolCallStarted' }))

    const userMsgs = bus.getHistoryByType('s1', 'UserMessage')
    expect(userMsgs).toHaveLength(1)
    expect(userMsgs[0].type).toBe('UserMessage')
  })

  it('clears session history', () => {
    bus.emit(makeEvent({ sessionId: 's1' }))
    bus.emit(makeEvent({ sessionId: 's1' }))
    bus.clearHistory('s1')
    expect(bus.getHistory('s1')).toHaveLength(0)
  })

  it('handles listener errors without affecting other listeners', () => {
    const good: SessionEvent[] = []
    bus.subscribe('*', () => {
      throw new Error('bad listener')
    })
    bus.subscribe('*', (e) => good.push(e))
    bus.emit(makeEvent())
    expect(good).toHaveLength(1)
  })
})
