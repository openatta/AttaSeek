import { useState, useEffect } from 'react'

interface Policy {
  id: string
  scope: string
  scopeId: string
  decision: string
}

export default function PermissionsSettings() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const result = await window.api.permission.listPolicies()
        if (result && result.policies) {
          setPolicies(result.policies)
        }
      } catch (err) {
        console.error('[PermissionsSettings] load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="p-4 text-xs text-[var(--app-text-dim)]">Loading…</div>

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-sm font-semibold text-[var(--app-text)]">Permission Policies</h2>
      <p className="text-xs text-[var(--app-text-secondary)]">
        Configure which tools are allowed, require confirmation, or are denied.
      </p>
      {policies.length === 0 ? (
        <p className="text-xs text-[var(--app-text-dim)]">No custom policies defined.</p>
      ) : (
        <div className="space-y-2">
          {policies.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-inset)] px-4 py-3">
              <div>
                <p className="text-xs font-medium text-[var(--app-text)]">{p.scopeId}</p>
                <p className="text-[10px] text-[var(--app-text-dim)]">{p.scope}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${
                p.decision === 'deny' ? 'bg-red-500/10 text-red-400' :
                p.decision === 'ask' ? 'bg-amber-500/10 text-amber-400' :
                'bg-green-500/10 text-green-400'
              }`}>
                {p.decision}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
