/**
 * Session-level atoms — event stream, tasks, artifacts per activity.
 * Each Activity (chat, projects, etc.) gets its own independent session.
 */

import { atom } from 'jotai'
import { activeActivityAtom } from './activityAtom'
import { createTempSessionId } from '../../shared/constants'
import type { SessionEvent } from '../../shared/types/SessionEvent'
import type { AgentTask } from '../../shared/types/AgentTask'
import type { Artifact } from '../../shared/types/Artifact'

/**
 * Per-activity auto-created session ID cache.
 * Module-level state (not Jotai) because it's lazily initialized inside a
 * derived atom's read function, where `set()` on other atoms is not available.
 * Each activity gets a temp ID on first access; overwritten by sidebar selection.
 */
const _activitySessionMap: Record<string, string> = {}

function ensureSession(activity: string): string {
  if (!_activitySessionMap[activity]) {
    _activitySessionMap[activity] = createTempSessionId(activity)
  }
  return _activitySessionMap[activity]
}

/** Per-session titles — updated by SessionTitleGenerated event. */
export const sessionTitleStoreAtom = atom<Record<string, string>>({})
export const sessionTitleAtom = atom(
  (get) => {
    const sid = get(currentSessionIdAtom)
    const map = get(sessionTitleStoreAtom)
    return map[sid] || 'New Session'
  },
  (get, set, title: string) => {
    const sid = get(currentSessionIdAtom)
    set(sessionTitleStoreAtom, (prev) => ({ ...prev, [sid]: title }))
  },
)

/** Internal: per-activity session ID override, set by sidebar selection. */
const _sessionIdOverrideAtom = atom<Record<string, string>>({})

/** Current session ID — derived from active activity, overridable via write (for sidebar selection). */
export const currentSessionIdAtom = atom(
  (get) => {
    const activity = get(activeActivityAtom)
    const override = get(_sessionIdOverrideAtom)
    if (override[activity]) return override[activity]
    return ensureSession(activity)
  },
  (get, set, id: string) => {
    const activity = get(activeActivityAtom)
    set(_sessionIdOverrideAtom, (prev) => ({ ...prev, [activity]: id }))
  },
)

/** All session events for the current session (latest first) */
export const sessionEventsAtom = atom<SessionEvent[]>([])

/** Events filtered to the current session — derived, avoids per-render O(n) filter. */
export const currentSessionEventsAtom = atom((get) => {
  const events = get(sessionEventsAtom)
  const sessionId = get(currentSessionIdAtom)
  return events.filter((e) => e.sessionId === sessionId)
})

/** Current active agent tasks for the session */
export const agentTasksAtom = atom<AgentTask[]>([])

/** Current session artifacts (projection from ArtifactService) */
export const artifactsAtom = atom<Artifact[]>([])

/** Active (selected) artifact ID */
export const activeArtifactAtom = atom<string | null>(null)

/** All projects (loaded from global projects.json) */
import type { ProjectInfo } from '../../shared/types/ipc'
export const projectsAtom = atom<ProjectInfo[]>([])

/** Selected project ID in Projects activity — input disabled when null */
export const selectedProjectIdAtom = atom<string | null>(null)

/** Debug log entries — captured from renderer console. Clearable. */
export interface DebugLogEntry { time: string; level: string; msg: string }
export const debugLogsAtom = atom<DebugLogEntry[]>([])

/** Streaming message buffers — keyed by messageId, accumulates chunk deltas */
export const streamingBuffersAtom = atom<Record<string, string>>({})

/**
 * Handle an incoming agent event from the main process.
 * Called by the global event listener set up in App.tsx.
 * Updates sessionEventsAtom, agentTasksAtom, and streamingBuffersAtom.
 */
export function handleAgentEvent(
  event: SessionEvent,
  setters: {
    setSessionEvents: (update: (prev: SessionEvent[]) => SessionEvent[]) => void
    setAgentTasks: (update: (prev: AgentTask[]) => AgentTask[]) => void
    setStreamingBuffers?: (update: (prev: Record<string, string>) => Record<string, string>) => void
    messageBufRef?: { current: Map<string, string> }
    setSessionTitle?: (sid: string, title: string) => void
    addDebugLog?: (entry: DebugLogEntry) => void
  },
): void {
  const { setSessionEvents, setAgentTasks, setStreamingBuffers, messageBufRef, setSessionTitle, addDebugLog } = setters

  if (addDebugLog) {
    const now = new Date().toISOString().slice(11, 19)
    addDebugLog({ time: now, level: 'info', msg: `event: ${event.type} sid=${event.sessionId?.slice(0,12)} taskId=${event.taskId?.slice(0,8)}` })
  }
  // Handle streaming chunks — accumulate in buffer and ref, don't add to event list yet
  if (event.type === 'AgentMessageChunk') {
    const payload = event.payload

    // Accumulate in ref (synchronous, immediate access to full text)
    if (messageBufRef) {
      const existing = messageBufRef.current.get(payload.messageId) || ''
      messageBufRef.current.set(payload.messageId, existing + payload.content)
    }

    // Also update Jotai streaming buffer (for live display during streaming)
    if (setStreamingBuffers) {
      setStreamingBuffers((prev) => {
        const existing = prev[payload.messageId] || ''
        return { ...prev, [payload.messageId]: existing + payload.content }
      })
    }

    // On final chunk: update the existing AgentMessage placeholder with full text
    // (Don't create a new event — that causes a render jump where content disappears)
    if (payload.isFinal) {
      const fullText = messageBufRef ? (messageBufRef.current.get(payload.messageId) || '') : ''
      if (messageBufRef) messageBufRef.current.delete(payload.messageId)
      if (setStreamingBuffers) {
        setStreamingBuffers((prev) => { const next = { ...prev }; delete next[payload.messageId]; return next })
      }
      // Find the last AgentMessage for this session (the placeholder) and update its content
      setSessionEvents((prev) => {
        const idx = prev.findLastIndex( (e) => e.type === 'AgentMessage' && e.sessionId === event.sessionId)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], payload: { content: fullText } } as SessionEvent
          return updated
        }
        // Fallback: no placeholder found → append new
        return [...prev, { id: event.id, sessionId: event.sessionId, taskId: event.taskId, type: 'AgentMessage', payload: { content: fullText }, createdAt: event.createdAt } as SessionEvent]
      })
    }
    return
  }

  // Normal events — append to sessionEventsAtom (with global cap)
  setSessionEvents((prev) => {
    // LLM-generated title: update header atom (DB persistence handled in App.tsx)
    // SessionTitleGenerated: only sets if title is empty (first-message gate)
    if (event.type === 'SessionTitleGenerated') {
      if (event.payload.title) {
        if (setSessionTitle) setSessionTitle(event.sessionId, event.payload.title)
      }
    }
    const MAX_EVENTS = 2000
    if (prev.length >= MAX_EVENTS) {
      // Drop oldest (N - 1) items proactively, avoiding the double-copy of spread + slice
      return [...prev.slice(-MAX_EVENTS + 1), event]
    }
    return [...prev, event]
  })

  // Update task status on completion/failure
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
