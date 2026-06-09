/**
 * TaskNotificationQueue — collects completed background worker results
 * and formats them as user-role messages for injection into the
 * coordinator's conversation stream.
 *
 * Mirrors Claude Code's queuedCommands + <task-notification> XML pattern.
 *
 * Lifecycle:
 *   1. SubAgentManager.forkAsync() enqueues on worker completion
 *   2. Coordinator's query-loop drains pending at start of each iteration
 *   3. Notifications are injected as user-role messages before the LLM call
 *
 * Deduplication: each agentId is drained exactly once. After drainPending()
 * returns, subsequent calls with the same agentId return nothing.
 */

import type { LLMMessage } from './llm/ModelProvider'
import type { TaskNotificationPayload } from '../../shared/types/SessionEvent'

/** Internal notification record — stored per-agent until drained. */
interface QueuedNotification {
  sessionId: string
  agentId: string
  payload: TaskNotificationPayload
  enqueuedAt: number
}

/** XML wrapper tag for task notifications — mirrors Claude Code format. */
const NOTIFICATION_WRAPPER = 'task-notification'

/** Maximum drained entries before eviction (prevents unbounded growth). */
const MAX_DRAINED_SIZE = 500

export class TaskNotificationQueue {
  /** Pending notifications, keyed by agentId (dedup by ID). */
  private pending = new Map<string, QueuedNotification>()

  /** Set of agentIds already drained (prevents double-delivery). */
  private drained = new Set<string>()

  /**
   * Enqueue a worker completion notification.
   * Called by SubAgentManager when a background worker finishes.
   * Overwrites any existing notification for the same agentId (last-write-wins).
   */
  enqueue(sessionId: string, agentId: string, payload: TaskNotificationPayload): void {
    if (this.drained.has(agentId)) {
      return // Already consumed — don't re-deliver
    }
    this.pending.set(agentId, {
      sessionId,
      agentId,
      payload,
      enqueuedAt: Date.now(),
    })
  }

  /**
   * Drain all pending notifications for a given session.
   *
   * Returns formatted user-role LLMMessage entries ready for injection
   * into the coordinator's conversation. Each agentId is returned exactly
   * once — subsequent calls will not return the same notification.
   *
   * Called by the query loop at the start of each iteration.
   */
  drainPending(sessionId: string): LLMMessage[] {
    const result: LLMMessage[] = []
    for (const [agentId, n] of this.pending) {
      if (n.sessionId !== sessionId) continue
      result.push(this.formatNotification(n.payload))
      this.pending.delete(agentId)
      this.drained.add(agentId)
    }

    // Evict oldest drained entries if set exceeds capacity
    if (this.drained.size > MAX_DRAINED_SIZE) {
      const toRemove = this.drained.size - Math.floor(MAX_DRAINED_SIZE * 0.75)
      let removed = 0
      for (const id of this.drained) {
        if (removed >= toRemove) break
        this.drained.delete(id)
        removed++
      }
    }

    return result
  }

  /**
   * Cancel a pending notification by agentId.
   * Called when a worker is stopped via TaskStop before completing.
   */
  cancel(agentId: string): void {
    this.pending.delete(agentId)
    this.drained.add(agentId)
  }

  /**
   * Cancel all pending notifications for a session.
   * Called on session close / abort.
   */
  cancelAll(sessionId: string): void {
    for (const [agentId, n] of this.pending) {
      if (n.sessionId === sessionId) {
        this.pending.delete(agentId)
        this.drained.add(agentId)
      }
    }
  }

  /** Number of pending (undrained) notifications. */
  get pendingCount(): number {
    return this.pending.size
  }

  /** Total number of drained+consumed notifications (for observability). */
  get drainedCount(): number {
    return this.drained.size
  }

  /** Reset all state — for testing. */
  reset(): void {
    this.pending.clear()
    this.drained.clear()
  }

  // ── Private helpers ──

  /** Format a TaskNotificationPayload into an LLMMessage (user role). */
  private formatNotification(payload: TaskNotificationPayload): LLMMessage {
    const xml = this.buildTaskNotificationXML(payload)
    return {
      role: 'user',
      content: [{ type: 'text', text: xml }],
    }
  }

  /**
   * Build the <task-notification> XML block.
   * Format mirrors Claude Code's task result injection pattern.
   */
  private buildTaskNotificationXML(payload: TaskNotificationPayload): string {
    const lines: string[] = [
      `<${NOTIFICATION_WRAPPER}>`,
      `  <task-id>${payload.agentId}</task-id>`,
      `  <status>${payload.status}</status>`,
      `  <summary>${payload.summary}</summary>`,
    ]

    if (payload.result) {
      lines.push(`  <result>${this.truncateResult(payload.result)}</result>`)
    }

    if (payload.usage) {
      lines.push(`  <usage>`)
      lines.push(`    <total_tokens>${payload.usage.totalTokens}</total_tokens>`)
      lines.push(`    <tool_uses>${payload.usage.toolUses}</tool_uses>`)
      lines.push(`    <duration_ms>${payload.usage.durationMs}</duration_ms>`)
      lines.push(`  </usage>`)
    }

    lines.push(`</${NOTIFICATION_WRAPPER}>`)
    return lines.join('\n')
  }

  /** Truncate large result texts to prevent context pollution. */
  private truncateResult(text: string, maxLen = 2000): string {
    if (text.length <= maxLen) return text
    return text.slice(0, maxLen) + '\n... [truncated — use task_output tool to read full result]'
  }
}

/** Singleton instance for the main process. */
export const taskNotificationQueue = new TaskNotificationQueue()
