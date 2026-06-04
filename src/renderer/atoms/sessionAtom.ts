/**
 * Session-level atoms — event stream, tasks, artifacts for the current session.
 * These are frontend projections of main process state (AgentEventBus → IPC → atoms).
 */

import { atom } from 'jotai'
import type { SessionEvent } from '../core/types/SessionEvent'
import type { AgentTask } from '../core/types/AgentTask'
import type { Artifact } from '../core/types/Artifact'

/** Current session ID (mock until real session management is added) */
export const currentSessionIdAtom = atom<string>('session_default')

/** All session events for the current session (latest first) */
export const sessionEventsAtom = atom<SessionEvent[]>([])

/** Current active agent tasks for the session */
export const agentTasksAtom = atom<AgentTask[]>([])

/** Current session artifacts (projection from ArtifactService) */
export const artifactsAtom = atom<Artifact[]>([])

/** Active (selected) artifact ID */
export const activeArtifactAtom = atom<string | null>(null)

/**
 * Handle an incoming agent event from the main process.
 * Called by the global event listener set up in App.tsx.
 * Updates sessionEventsAtom and agentTasksAtom.
 */
export function handleAgentEvent(
  event: SessionEvent,
  setSessionEvents: (update: (prev: SessionEvent[]) => SessionEvent[]) => void,
  setAgentTasks: (update: (prev: AgentTask[]) => AgentTask[]) => void,
): void {
  setSessionEvents((prev) => [...prev, event])

  if (event.type === 'TaskCompleted' || event.type === 'TaskFailed') {
    setAgentTasks((prev) =>
      prev.map((t) =>
        t.id === event.taskId
          ? {
              ...t,
              status:
                event.type === 'TaskCompleted'
                  ? ('completed' as const)
                  : ('failed' as const),
              updatedAt: event.createdAt,
            }
          : t,
      ),
    )
  }
}
