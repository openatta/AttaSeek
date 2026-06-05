import { useState } from 'react'
import type { PermissionRequestedPayload } from '../../../core/types/SessionEvent'

interface Props {
  payload: PermissionRequestedPayload
}

export default function PermissionRequestedEvent({ payload }: Props) {
  const [responded, setResponded] = useState(false)

  const handleDecision = (decision: 'allow' | 'deny') => {
    if (window.api?.permission?.respond) {
      window.api.permission.respond(payload.permissionRequestId, decision)
    }
    setResponded(true)
  }

  if (responded) {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-[var(--app-text-dim)]">
          Permission {responded ? 'confirmed' : ''}
        </span>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="bg-[var(--app-bg-inset)] border border-amber-500/30 rounded-xl px-4 py-3 max-w-[85%]">
        <p className="text-xs font-semibold text-amber-400 mb-2">⚠ Permission Required</p>
        <p className="text-xs text-[var(--app-text)] mb-1">
          <code className="text-[var(--app-accent)]">{payload.toolName}</code> wants to:
        </p>
        <p className="text-[11px] text-[var(--app-text-secondary)] mb-3">{payload.action}</p>

        {payload.preview && (
          <div className="bg-[var(--app-bg)] rounded-md p-2 mb-3 border border-[var(--app-border)]">
            <p className="text-[10px] text-[var(--app-text-dim)] mb-1">Preview:</p>
            <pre className="text-[11px] text-[var(--app-text-secondary)] whitespace-pre-wrap font-mono">
              {payload.preview}
            </pre>
          </div>
        )}

        <p className="text-[10px] text-[var(--app-text-dim)] mb-2">
          Impact: {payload.impact}
          {payload.rollbackable ? ' • Can be rolled back' : ' • Cannot be undone'}
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDecision('allow')}
            className="px-3 py-1 rounded-md text-[11px] bg-[var(--app-accent)] text-white hover:opacity-90"
          >
            Allow
          </button>
          <button
            onClick={() => handleDecision('deny')}
            className="px-3 py-1 rounded-md text-[11px] border border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  )
}
