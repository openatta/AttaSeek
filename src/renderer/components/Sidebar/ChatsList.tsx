import { useEffect, useState, useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { currentSessionIdAtom } from '../../atoms/sessionAtom'
import { useTranslation } from '../../i18n'
import { Trash2, Pencil } from 'lucide-react'

interface SessionInfo { id: string; title: string; activity: string; createdAt: number; updatedAt: number }

export default function ChatsList() {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; session: SessionInfo } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const setCurrentSessionId = useSetAtom(currentSessionIdAtom)

  const refresh = useCallback(() => {
    if (!window.api?.session) return
    window.api.session.list().then((res) => { if (res.sessions) setSessions(res.sessions) }).catch((e) => { console.warn('[ChatsList] refresh sessions failed:', e instanceof Error ? e.message : String(e)) })
  }, [])

  useEffect(() => {
    refresh()
    // Subscribe to real-time title updates from main process
    const unsub = window.api?.session?.onUpdate?.((data) => {
      setSessions((prev) => prev.map((s) => s.id === data.id ? { ...s, title: data.title } : s))
    })
    return () => { unsub?.() }
  }, [refresh])

  // Close context menu on click outside
  useEffect(() => { const h = () => setContextMenu(null); document.addEventListener('click', h); return () => document.removeEventListener('click', h) }, [])

  const { t } = useTranslation()
  const filtered = search ? sessions.filter(s => s.title.toLowerCase().includes(search.toLowerCase())) : sessions

  // Group by activity
  const groups: Record<string, SessionInfo[]> = {}
  for (const s of filtered) { const k = s.activity || 'chat'; if (!groups[k]) groups[k] = []; groups[k].push(s) }

  const doRename = (id: string) => {
    if (!renameValue.trim()) return
    window.api?.session?.update(id, { title: renameValue.trim() }).then(() => { setRenaming(null); refresh() }).catch((e) => { console.warn('[ChatsList] rename failed:', e instanceof Error ? e.message : String(e)) })
  }

  const doDelete = (id: string) => {
    window.api?.session?.delete(id).then(() => refresh()).catch((e) => { console.warn('[ChatsList] delete failed:', e instanceof Error ? e.message : String(e)) })
  }

  return (
    <div className="flex flex-col flex-1" onContextMenu={e => e.preventDefault()}>
      <div className="px-3 pb-2">
        <input type="text" placeholder={t('chats.search')} value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-[var(--app-bg-inset)] border border-[var(--app-border)] rounded-md px-3 py-1.5 text-xs text-[var(--app-text)] placeholder:text-[var(--app-text-dim)] outline-none focus:border-[var(--app-accent)] transition-colors" />
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {Object.keys(groups).length === 0 ? (
          <div className="flex items-center justify-center h-full"><p className="text-xs text-[var(--app-text-dim)]">{t('chats.noConversations')}</p></div>
        ) : (
          Object.entries(groups).map(([activity, items]) => (
            <div key={activity} className="mb-3">
              <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--app-text-dim)]">{activity}</div>
              {items.map(s => (
                <div key={s.id}>
                  {renaming === s.id ? (
                    <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') doRename(s.id); if (e.key === 'Escape') setRenaming(null) }}
                      onBlur={() => setRenaming(null)}
                      className="w-full px-2 py-1 text-xs rounded bg-[var(--app-bg-inset)] border border-[var(--app-accent)] text-[var(--app-text)] outline-none" />
                  ) : (
                    <button onClick={() => setCurrentSessionId(s.id)}
                      onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, session: s }) }}
                      className="w-full text-left px-2 py-1 rounded-md text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors truncate">
                      {s.title || t('chats.newSession')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {contextMenu && (
        <div className="fixed z-50 bg-[var(--app-bg-elevated)] border border-[var(--app-border)] rounded-lg shadow-lg py-1 min-w-[140px]" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button onClick={() => { setContextMenu(null); setRenaming(contextMenu.session.id); setRenameValue(contextMenu.session.title) }}
            className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] flex items-center gap-2"><Pencil className="w-3 h-3" /> {t('chats.rename')}</button>
          <button onClick={() => { setContextMenu(null); doDelete(contextMenu.session.id) }}
            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-[var(--app-bg-hover)] flex items-center gap-2"><Trash2 className="w-3 h-3" /> {t('chats.delete')}</button>
        </div>
      )}
    </div>
  )
}
