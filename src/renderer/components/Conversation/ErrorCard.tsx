/**
 * ErrorCard — displayed in Conversation flow when a task fails.
 * Shows error message + retry button (when recoverable).
 */

import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorCardProps {
  error: string
  recoverable?: boolean
  onRetry?: () => void
}

export default function ErrorCard({ error, recoverable = true, onRetry }: ErrorCardProps) {
  return (
    <div className="flex justify-start">
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 max-w-[85%]">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <p className="text-xs font-semibold text-red-400">Error</p>
        </div>
        <p className="text-xs text-[var(--app-text-secondary)] mb-2">{error}</p>
        {recoverable && onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-[11px] border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
