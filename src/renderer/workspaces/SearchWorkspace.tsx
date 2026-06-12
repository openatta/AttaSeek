/**
 * Search workspace — global search for sessions and commands.
 * Typing filters the session list in real-time; results are navigable.
 */

import { useState, useEffect, useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { currentSessionIdAtom, sessionEventsAtom, streamingBuffersAtom, sessionTitleStoreAtom } from '../atoms/sessionAtom'
import { useSessionList } from '../components/Sidebar/useSessionList'
import { getApi } from '../utils/api'
import type { SessionInfo } from '../../shared/types/AgentTask'

export default function SearchWorkspace() {
  const { sessions, refresh } = useSessionList()
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const setCurrentSessionId = useSetAtom(currentSessionIdAtom)
  const setSessionEvents = useSetAtom(sessionEventsAtom)
  const setTitleStore = useSetAtom(sessionTitleStoreAtom)
  const setStreamingBuffers = useSetAtom(streamingBuffersAtom)

  const filtered = query
    ? sessions.filter(s => s.title.toLowerCase().includes(query.toLowerCase()))
    : sessions.slice(0, 10)

  // Reset selection when results change
  useEffect(() => { setSelectedIdx(0) }, [query])

  const switchToSession = useCallback(async (s: SessionInfo) => {
    setStreamingBuffers({})
    setCurrentSessionId(s.id)
    if (s.title && s.title !== 'New Session') {
      setTitleStore(prev => ({ ...prev, [s.id]: s.title }))
    }
    const api = getApi()
    try {
      const res = await api.agent.listEvents(s.id)
      setSessionEvents(prev => {
        const seen = new Set(prev.map(e => e.id))
        const fresh = (res.events || []).filter((e: { id?: string }) => e.id && !seen.has(e.id))
        return fresh.length > 0 ? [...prev, ...fresh] : prev
      })
      const titleEvt = (res.events || []).find(
        (e: Record<string, unknown>) => e['type'] === 'SessionTitleGenerated'
      ) as Record<string, unknown> | undefined
      if (titleEvt?.['payload'] && typeof titleEvt['payload'] === 'object') {
        const payload = titleEvt['payload'] as Record<string, unknown>
        if (typeof payload['title'] === 'string') {
          setTitleStore(prev => ({ ...prev, [s.id]: payload['title'] as string }))
        }
      }
    } catch (_) { /* skip */ }
  }, [setCurrentSessionId, setSessionEvents, setStreamingBuffers, setTitleStore])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && filtered[selectedIdx]) {
      void switchToSession(filtered[selectedIdx])
    }
  }

  return (
    <div className="flex h-full min-w-0">
      {/* Sidebar */}
      <div className="flex-shrink-0 border-r border-[var(--app-border)] overflow-y-auto flex flex-col h-full" style={{ width: 220 }}>
        <div className="flex-shrink-0 h-[40px]" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
        <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider px-4 pb-2">SEARCH</h2>
        <div className="px-4 pb-4 space-y-1">
          {['Sessions', 'Commands'].map((f) => (
            <button key={f} className="block w-full text-left px-3 py-1.5 rounded-md text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors">{f}</button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 min-w-0 flex flex-col p-6">
        <input
          type="text"
          placeholder="Search sessions by title..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          className="w-full max-w-lg bg-[var(--app-bg-inset)] border border-[var(--app-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-dim)] outline-none focus:border-[var(--app-accent)] transition-colors"
        />

        <div className="mt-4 max-w-lg">
          {filtered.length === 0 ? (
            <p className="text-xs text-[var(--app-text-dim)]">
              {query ? 'No sessions found' : 'Start typing to search sessions'}
            </p>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => { void switchToSession(s) }}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                    i === selectedIdx
                      ? 'bg-[var(--app-accent)] text-white'
                      : 'text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] hover:text-[var(--app-text)]'
                  }`}
                >
                  <span className="truncate block">{s.title || 'New Session'}</span>
                  <span className="text-[10px] opacity-60">{s.activity || 'chat'} · {new Date(s.updatedAt).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
