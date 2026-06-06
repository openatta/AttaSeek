import { useState, useEffect } from 'react'

interface MemoryEntry {
  id: string
  scope: string
  type: string
  content: string
  createdAt: number
}

export default function MemorySettings() {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const result = await window.api.memory.list()
      if (result && result.entries) {
        setEntries(result.entries)
      }
    } catch (err) {
      console.error('[MemorySettings] load error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    await window.api.memory.delete(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  if (loading) return <div className="p-4 text-xs text-[var(--app-text-dim)]">Loading…</div>

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">Memory</h2>
      <p className="text-xs text-[var(--app-text-secondary)]">
        Agent memories are visible, editable, and deletable. You control what the agent remembers.
      </p>
      {entries.length === 0 ? (
        <p className="text-xs text-[var(--app-text-dim)]">No stored memories.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-inset)] px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[var(--app-text-dim)] uppercase">{e.type} · {e.scope}</span>
                <button
                  onClick={() => handleDelete(e.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
              <p className="text-xs text-[var(--app-text)]">{e.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
