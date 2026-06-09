import { useState, useEffect, useCallback } from 'react'
import type { SessionInfo } from '../../../shared/types/AgentTask'

/**
 * Hook: fetch session list + subscribe to real-time updates from main process.
 * Returns the session list and a manual refresh function.
 */
export function useSessionList(): { sessions: SessionInfo[]; refresh: () => void } {
  const [sessions, setSessions] = useState<SessionInfo[]>([])

  const refresh = useCallback(() => {
    if (!window.api?.session) return
    window.api.session
      .list()
      .then((res) => {
        if (res.sessions) setSessions(res.sessions)
      })
      .catch((e) => {
        console.warn(
          '[ChatsList] refresh sessions failed:',
          e instanceof Error ? e.message : String(e),
        )
      })
  }, [])

  useEffect(() => {
    refresh()

    // Subscribe to real-time updates from main process
    const unsub = window.api?.session?.onUpdate?.((data) => {
      setSessions((prev) => {
        const exists = prev.some((s) => s.id === data.id)
        if (exists) {
          return prev.map((s) =>
            s.id === data.id ? { ...s, title: data.title } : s,
          )
        }
        // New session — refresh full list
        refresh()
        return prev
      })
    })

    return () => {
      unsub?.()
    }
  }, [refresh])

  return { sessions, refresh }
}
