import { useEffect, useState } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { currentSessionIdAtom, sessionEventsAtom, streamingBuffersAtom, sessionTitleStoreAtom } from '../../atoms/sessionAtom'
import { useTranslation } from '../../i18n'
import { MoreHorizontal } from 'lucide-react'
import type { SessionInfo } from '../../../shared/types/AgentTask'
import SessionMenu from './SessionMenu'
import { useSessionList } from './useSessionList'
import { createTempSessionId } from '../../../shared/constants'

export default function ChatsList() {
  const { sessions, refresh } = useSessionList()
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const currentSessionId = useAtomValue(currentSessionIdAtom)
  const setCurrentSessionId = useSetAtom(currentSessionIdAtom)
  const setSessionEvents = useSetAtom(sessionEventsAtom)
  const setTitleStore = useSetAtom(sessionTitleStoreAtom)
  const setStreamingBuffers = useSetAtom(streamingBuffersAtom)

  // Close menu on click outside
  useEffect(() => { const h = () => setMenuOpen(null); document.addEventListener('click', h); return () => document.removeEventListener('click', h) }, [])

  const { t } = useTranslation()
  const filtered = search ? sessions.filter(s => s.title.toLowerCase().includes(search.toLowerCase())) : sessions

  // Group by activity
  const groups: Record<string, SessionInfo[]> = {}
  for (const s of filtered) { const k = s.activity || 'chat'; if (!groups[k]) groups[k] = []; groups[k].push(s) }

  const switchToSession = async (s: SessionInfo) => {
    // Clear in-flight streaming buffers so old session's stream content
    // doesn't leak into the newly-activated session's message flow.
    setStreamingBuffers({})
    setCurrentSessionId(s.id)

    // Restore title: prefer persisted title, fallback to extracting from events
    if (s.title && s.title !== 'New Session') {
      setTitleStore(prev => ({ ...prev, [s.id]: s.title }))
    }

    // Merge persisted events into atom (single de-dupe point — IPC returns disk-only).
    // Don't replace — other sessions' events must stay in the atom for fast switch-back.
    if (window.api?.agent?.listEvents) {
      try {
        const res = await window.api.agent.listEvents(s.id)
        setSessionEvents(prev => {
          const seen = new Set(prev.map(e => e.id))
          const fresh = (res.events || []).filter(e => e.id && !seen.has(e.id))
          return fresh.length > 0 ? [...prev, ...fresh] : prev
        })
        // Extract title from SessionTitleGenerated events loaded from disk
        // (these bypass handleAgentEvent, so we must seed the title store here).
        const titleEvt = (res.events || []).find((e: any) => e.type === 'SessionTitleGenerated')
        if (titleEvt?.payload?.title) {
          setTitleStore(prev => ({ ...prev, [s.id]: titleEvt.payload.title }))
        }
      } catch (e) { console.warn('[ChatsList] load events failed:', e instanceof Error ? e.message : String(e)) }
    }
  }

  const doRename = (id: string) => {
    if (!renameValue.trim()) return
    window.api?.session?.update(id, { title: renameValue.trim() }).then(() => { setRenaming(null); refresh() }).catch((e) => { console.warn('[ChatsList] rename failed:', e instanceof Error ? e.message : String(e)) })
  }

  const doDelete = (id: string) => {
    window.api?.session?.delete(id).then(() => {
      setMenuOpen(null)
      // If deleting the currently-active session, switch to a fresh temp session
      // and clear events so the right panel doesn't show stale content.
      if (id === currentSessionId) {
        setCurrentSessionId(createTempSessionId())
        setSessionEvents([])
      }
      refresh()
    }).catch((e) => { console.warn('[ChatsList] delete failed:', e instanceof Error ? e.message : String(e)) })
  }

  return (
    <div className="flex flex-col flex-1" onContextMenu={e => e.preventDefault()}>
      <div className="px-3 pb-2">
        <input type="text" placeholder={t('chats.search')} value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-[var(--app-bg-inset)] border border-[var(--app-border)] rounded-md px-3 py-1.5 text-xs text-[var(--app-text)] placeholder:text-[var(--app-text-dim)] outline-none focus:border-[var(--app-accent)] transition-colors" />
      </div>

      <div className="flex-1 min-h-0 relative">
        <div className="h-full overflow-y-auto px-2">
        {Object.keys(groups).length === 0 ? (
          <div className="flex items-center justify-center h-full"><p className="text-xs text-[var(--app-text-dim)]">{t('chats.noConversations')}</p></div>
        ) : (
          Object.entries(groups).map(([activity, items]) => (
            <div key={activity} className="mb-3">
              <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--app-text-dim)]">{activity}</div>
              {items.map(s => (
                <div key={s.id} className="group relative">
                  {renaming === s.id ? (
                    <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') doRename(s.id); if (e.key === 'Escape') setRenaming(null) }}
                      onBlur={() => setRenaming(null)}
                      className="w-full px-2 py-1 text-xs rounded bg-[var(--app-bg-inset)] border border-[var(--app-accent)] text-[var(--app-text)] outline-none" />
                  ) : (
                    <div className="flex items-center">
                      <button onClick={() => switchToSession(s)}
                        className="flex-1 text-left px-2 py-1 rounded-md text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors truncate">
                        {s.title || t('chats.newSession')}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === s.id ? null : s.id) }}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-dim)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors opacity-0 group-hover:opacity-100"
                        title="Actions"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
        </div>
        {/* Dropdown rendered outside scroll container so it floats above */}
        {menuOpen && (() => {
          const s = sessions.find(x => x.id === menuOpen)
          if (!s) return null
          return (
            <SessionMenu
              session={s}
              onRename={() => { setMenuOpen(null); setRenaming(s.id); setRenameValue(s.title) }}
              onDelete={() => doDelete(s.id)}
            />
          )
        })()}
      </div>
    </div>
  )
}
