interface PermissionInlineProps {
  message: string
  onAllowOnce?: () => void
  onAllowSession?: () => void
  onDeny?: () => void
}

export default function PermissionInline({
  message,
  onAllowOnce,
  onAllowSession,
  onDeny
}: PermissionInlineProps) {
  return (
    <div className="px-4 py-1">
      <div className="border border-amber-700/50 rounded-lg bg-amber-900/10 px-3 py-2">
        <div className="flex items-start gap-2">
          <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-200 mb-2">{message}</p>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={onAllowOnce}
                className="text-[11px] px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
              >
                Allow
              </button>
              <button
                onClick={onAllowSession}
                className="text-[11px] px-2.5 py-1 rounded border border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
              >
                Allow this session
              </button>
              <button
                onClick={onDeny}
                className="text-[11px] px-2.5 py-1 rounded border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] transition-colors"
              >
                Deny
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
