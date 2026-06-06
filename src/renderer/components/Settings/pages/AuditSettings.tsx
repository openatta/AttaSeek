import { useState, useEffect } from 'react'

interface AuditEntry {
  id: string
  eventType: string
  taskId?: string
  sessionId?: string
  createdAt: number
  summary?: string
}

export default function AuditSettings() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const result = await window.api.audit.list()
        if (result && result.logs) {
          setLogs(result.logs.slice(0, 50))
        }
      } catch (err) {
        console.error('[AuditSettings] load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="p-4 text-xs text-[var(--app-text-dim)]">Loading…</div>

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">Audit Log</h2>
      <p className="text-xs text-[var(--app-text-secondary)]">
        All agent actions, tool calls, and permission decisions are logged. Showing last 50 entries.
      </p>
      {logs.length === 0 ? (
        <p className="text-xs text-[var(--app-text-dim)]">No audit entries yet.</p>
      ) : (
        <div className="space-y-1">
          {logs.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-3 py-1.5 rounded text-xs hover:bg-[var(--app-bg-hover)]">
              <span className="text-[10px] text-[var(--app-text-dim)] w-16 flex-shrink-0">
                {new Date(l.createdAt).toLocaleTimeString()}
              </span>
              <span className="text-[var(--app-text-secondary)] flex-1 truncate">{l.eventType}</span>
              {l.taskId && <span className="text-[10px] text-[var(--app-text-dim)]">{l.taskId}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
