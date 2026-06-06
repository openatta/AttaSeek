/**
 * Session-level atoms — event stream, tasks, artifacts per activity.
 * Each Activity (chat, projects, etc.) gets its own independent session.
 */

import { atom } from 'jotai'
import { activeActivityAtom } from './activityAtom'
import type { SessionEvent } from '../../shared/types/SessionEvent'
import type { AgentTask } from '../../shared/types/AgentTask'
import type { Artifact } from '../../shared/types/Artifact'

// Per-activity session IDs — each activity has its own conversation state
const activitySessionMap: Record<string, string> = {}

function ensureSession(activity: string): string {
  if (!activitySessionMap[activity]) {
    activitySessionMap[activity] = `session_${activity}_${Date.now()}`
  }
  return activitySessionMap[activity]
}

/** Per-session titles — updated by SessionTitleGenerated event. Proper writable atom. */
export const _sessionTitleAtom = atom<Record<string, string>>({})
export const sessionTitleAtom = atom(
  (get) => {
    const sid = get(currentSessionIdAtom)
    const map = get(_sessionTitleAtom)
    return map[sid] || 'New Session'
  },
  (get, set, title: string) => {
    const sid = get(currentSessionIdAtom)
    set(_sessionTitleAtom, (prev) => ({ ...prev, [sid]: title }))
  },
)

/** Safe findLastIndex — compatible with older JS runtimes lacking ES2023 Array.findLastIndex */
function findLastIndex<T>(arr: T[], pred: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i
  }
  return -1
}

/** Current session ID — derived from active activity, overridable via write (for sidebar selection). */
export const currentSessionIdAtom = atom(
  (get) => {
    const activity = get(activeActivityAtom)
    if (_sessionOverride[activity]) return _sessionOverride[activity]
    return ensureSession(activity)
  },
  (get, set, id: string) => {
    const activity = get(activeActivityAtom)
    _sessionOverride[activity] = id
  },
)

// Internal override map (not exported — write through currentSessionIdAtom)
const _sessionOverride: Record<string, string> = {}

/** All session events for the current session (latest first) */
export const sessionEventsAtom = atom<SessionEvent[]>([])

/** Current active agent tasks for the session */
export const agentTasksAtom = atom<AgentTask[]>([])

/** Current session artifacts (projection from ArtifactService) */
export const artifactsAtom = atom<Artifact[]>([])

/** Active (selected) artifact ID */
export const activeArtifactAtom = atom<string | null>(null)

/** Selected project ID in Projects activity — input disabled when null */
export const selectedProjectIdAtom = atom<string | null>(null)

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
    /** Persist session title to DB — provided by App.tsx hook layer, not the atom */
    persistTitle?: (sessionId: string, title: string) => void
  },
): void {
  const { setSessionEvents, setAgentTasks, setStreamingBuffers, messageBufRef, setSessionTitle, persistTitle } = setters
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
        const idx = findLastIndex(prev, (e) => e.type === 'AgentMessage' && e.sessionId === event.sessionId)
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
    // LLM-generated title: persist to DB + update header atom
    if (event.type === 'SessionTitleGenerated') {
      if (event.payload.title) {
        // Update atom (triggers SessionHeader re-render)
        if (setSessionTitle) setSessionTitle(event.sessionId, event.payload.title)
        // Persist to DB via hook-provided callback (side effect isolated from atom)
        persistTitle?.(event.sessionId, event.payload.title)
      }
    }
    const MAX_EVENTS = 2000
    const next = [...prev, event]
    return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next
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
