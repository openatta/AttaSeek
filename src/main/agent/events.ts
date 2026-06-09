/**
 * Shared event factory and error helpers for agent modules.
 *
 * Used by query-loop and QueryEngine to produce
 * typed SessionEvent objects with a consistent shape. Previously
 * duplicated as `makeEvent` in all three files.
 */

import { newId } from '../store/id'
import { TelemetryService } from './telemetry/TelemetryService'
import type { AgentTask } from '../../shared/types/AgentTask'
import type { SessionEvent, SessionEventPayloadMap } from '../../shared/types/SessionEvent'

/** Create a typed SessionEvent for the given task. */
export function createSessionEvent<K extends keyof SessionEventPayloadMap>(
  task: AgentTask,
  type: K,
  payload: SessionEventPayloadMap[K],
): SessionEvent {
  return {
    id: newId(),
    sessionId: task.sessionId,
    taskId: task.id,
    type,
    payload,
    createdAt: Date.now(),
  } as SessionEvent
}

/**
 * Report a non-fatal error — log a warning, emit telemetry, and continue.
 *
 * Replaces raw `console.warn` calls scattered across orchestrators.
 * Non-fatal errors should not interrupt the agent loop; they signal
 * degraded but non-critical functionality (e.g., artifact creation
 * failure, memory write failure, audit log write failure).
 *
 * @param task      — The current task (for telemetry + warning context).
 * @param operation — Human-readable name of the failed operation.
 * @param err       — The error that was caught.
 */
export function emitNonFatal(task: AgentTask, operation: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  console.warn(`[Agent] non-fatal error in ${operation} (task ${task.id}): ${message}`)

  // Emit telemetry (best-effort — silently drop if the telemetry store itself is failing)
  try {
    const telemetry = new TelemetryService(task.sessionId, task.id)
    telemetry.emit('agent_query_error', {
      errorType: 'non_fatal',
      errorMessage: `${operation}: ${message}`.slice(0, 200),
      recoveryLevel: 'non_fatal',
      turnCount: 0,
    })
  } catch {
    // Telemetry failure must not cascade
  }
}
