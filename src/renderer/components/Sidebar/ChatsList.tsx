import { useEffect, useState } from 'react'
import { useSetAtom } from 'jotai'
import { currentSessionIdAtom } from '../../atoms/sessionAtom'

interface SessionInfo { id: string; title: string; activity: string; createdAt: number; updatedAt: number }

export default function ChatsList() {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const setCurrentSessionId = useSetAtom(currentSessionIdAtom)

  useEffect(() => {
    if (!window.api?.session) return
    const refresh = () =>
      window.api.session.list().then((res: any) => {
        if (res.sessions) setSessions(res.sessions)
      }).catch(() => {})
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col flex-1">
      <div className="px-3 pb-2">
        <input type="text" placeholder="Search chats..." className="w-full bg-[var(--app-bg-inset)] border border-[var(--app-border)] rounded-md px-3 py-1.5 text-xs text-[var(--app-text)] placeholder:text-[var(--app-text-dim)] outline-none focus:border-[var(--app-accent)] transition-colors" />
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {sessions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-[var(--app-text-dim)]">No conversations yet</p>
          </div>
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setCurrentSessionId(s.id)}
              className="w-full text-left px-2 py-1.5 rounded-md text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors truncate"
            >
              {s.title || 'New Session'}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
