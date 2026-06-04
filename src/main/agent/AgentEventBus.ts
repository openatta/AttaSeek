/**
 * AgentEventBus — typed event emitter for session-level events.
 * Main process emits; renderers subscribe via IPC.
 */

import type { SessionEvent, SessionEventType } from '../../renderer/core/types/SessionEvent'

type EventListener = (event: SessionEvent) => void

export class AgentEventBus {
  private listeners: Map<string, Set<EventListener>> = new Map()
  private eventHistory: Map<string, SessionEvent[]> = new Map()

  /** Emit an event to all session subscribers */
  emit(event: SessionEvent): void {
    // Store in history
    const history = this.eventHistory.get(event.sessionId) || []
    history.push(event)
    this.eventHistory.set(event.sessionId, history)

    // Notify session listeners
    const sessionListeners = this.listeners.get(event.sessionId)
    if (sessionListeners) {
      for (const listener of sessionListeners) {
        try {
          listener(event)
        } catch (err) {
          console.error('[AgentEventBus] listener error:', err)
        }
      }
    }

    // Notify global listeners
    const globalListeners = this.listeners.get('*')
    if (globalListeners) {
      for (const listener of globalListeners) {
        try {
          listener(event)
        } catch (err) {
          console.error('[AgentEventBus] global listener error:', err)
        }
      }
    }
  }

  /** Subscribe to events for a session (or '*' for all) */
  subscribe(sessionIdOrGlobal: string, listener: EventListener): () => void {
    if (!this.listeners.has(sessionIdOrGlobal)) {
      this.listeners.set(sessionIdOrGlobal, new Set())
    }
    this.listeners.get(sessionIdOrGlobal)!.add(listener)

    return () => {
      this.listeners.get(sessionIdOrGlobal)?.delete(listener)
    }
  }

  /** Get event history for a session */
  getHistory(sessionId: string): SessionEvent[] {
    return this.eventHistory.get(sessionId) || []
  }

  /** Get events of a specific type for a session */
  getHistoryByType(sessionId: string, type: SessionEventType): SessionEvent[] {
    return this.getHistory(sessionId).filter((e) => e.type === type)
  }

  /** Clear history for a session */
  clearHistory(sessionId: string): void {
    this.eventHistory.delete(sessionId)
  }
}

/** Singleton instance */
export const agentEventBus = new AgentEventBus()
