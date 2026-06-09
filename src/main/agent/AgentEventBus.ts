/**
 * AgentEventBus — typed event emitter for session-level events.
 * Main process emits; renderers subscribe via IPC.
 *
 * Phase E: Added fire-and-forget async write support (emitAsync) and
 * flush-on-demand for long-running sessions. Mirrors Claude Code's
 * fire-and-forget transcript pattern: assistant events are emitted
 * without blocking the query loop while order-preserving buffering
 * ensures correct sequence on flush.
 */

import type { SessionEvent, SessionEventType } from '../../shared/types/SessionEvent'

type EventListener = (event: SessionEvent) => void
type AsyncPersistFn = (events: SessionEvent[]) => Promise<void>

export class AgentEventBus {
  private listeners: Map<string, Set<EventListener>> = new Map()
  private eventHistory: Map<string, SessionEvent[]> = new Map()
  private static readonly MAX_EVENTS_PER_SESSION = 1000

  // ── Async write support (Phase E) ──

  /** Buffered events pending async persistence. */
  private asyncBuffer: SessionEvent[] = []

  /** Registered async persist function (set once at startup). */
  private asyncPersist: AsyncPersistFn | null = null

  /** Flush timer handle. */
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  /** Flush debounce interval (ms). Buffered writes flush after this idle period. */
  private static readonly FLUSH_DEBOUNCE_MS = 100

  /** Maximum buffer size before forced flush. */
  private static readonly MAX_BUFFER_SIZE = 50

  /**
   * Register an async persist function. Called during boot to wire SQLite
   * persistence into the event bus. Only one persist function can be registered.
   */
  registerAsyncPersist(fn: AsyncPersistFn): void {
    this.asyncPersist = fn
  }

  /**
   * Emit an event asynchronously — fire-and-forget.
   *
   * The event is delivered to listeners synchronously (same as `emit()`),
   * but persistence is deferred: events are buffered and flushed in bulk
   * after a short debounce window or when the buffer reaches capacity.
   *
   * Use for high-frequency events (streaming chunks, tool progress) where
   * blocking on each write would stall the query loop.
   *
   * Mirrors Claude Code's `void recordTranscript(messages)` fire-and-forget.
   */
  emitAsync(event: SessionEvent): void {
    // Deliver to listeners synchronously (UI needs real-time updates)
    this.deliverToListeners(event)

    // Buffer for async persistence
    this.asyncBuffer.push(event)
    if (this.asyncBuffer.length >= AgentEventBus.MAX_BUFFER_SIZE) {
      this.scheduleFlush()
    } else {
      this.scheduleFlushDebounced()
    }
  }

  /**
   * Flush all buffered async events to persistence.
   * Call before process exit or when critical state must be durably saved.
   */
  async flushAsync(): Promise<void> {
    this.cancelFlushTimer()
    if (this.asyncBuffer.length === 0) return

    const batch = this.asyncBuffer.splice(0)
    if (this.asyncPersist) {
      try {
        await this.asyncPersist(batch)
      } catch (err) {
        console.error('[AgentEventBus] async persist failed:', err)
        // Re-queue failed events at front (don't lose data)
        this.asyncBuffer.unshift(...batch)
      }
    }
  }

  /**
   * Flush async events synchronously (for critical paths like before result yield).
   * Returns a promise that resolves when done. Call with `await` before terminal states.
   */
  flushAsyncIfNeeded(): Promise<void> {
    if (this.asyncBuffer.length > 0) {
      return this.flushAsync()
    }
    return Promise.resolve()
  }

  private scheduleFlush(): void {
    // Immediate flush (buffer full)
    this.cancelFlushTimer()
    this.flushTimer = setTimeout(() => {
      void this.flushAsync()
    }, 0)
  }

  private scheduleFlushDebounced(): void {
    if (this.flushTimer) return // already scheduled
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flushAsync()
    }, AgentEventBus.FLUSH_DEBOUNCE_MS)
  }

  private cancelFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
  }

  // ── Synchronous emit ──

  /** Emit an event to all session subscribers */
  emit(event: SessionEvent): void {
    // Store in history with cap
    const history = this.eventHistory.get(event.sessionId) || []
    history.push(event)
    // Trim oldest events if over cap
    if (history.length > AgentEventBus.MAX_EVENTS_PER_SESSION) {
      history.splice(0, history.length - AgentEventBus.MAX_EVENTS_PER_SESSION)
    }
    this.eventHistory.set(event.sessionId, history)

    this.deliverToListeners(event)
  }

  // ── Subscriptions ──

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

  // ── Private ──

  private deliverToListeners(event: SessionEvent): void {
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
}

/** Singleton instance */
export const agentEventBus = new AgentEventBus()
