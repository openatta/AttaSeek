/**
 * ApEmptyState — shown when no tabs are open in the AP.
 * Displays large 64x64 icon + label buttons based on current context.
 *
 * CHATS: Browser, Terminal (2 buttons)
 * Project: Browser, Terminal, File, Review (4 buttons)
 */

import { useAvailablePanes } from '../../hooks/useAvailablePanes'
import { useAddTab } from '../../hooks/useAddTab'

export default function ApEmptyState() {
  const availablePanes = useAvailablePanes()
  const addTab = useAddTab()

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex items-center gap-12">
        {availablePanes.map((p) => (
          <button
            key={p.type}
            onClick={() => addTab(p.type)}
            className="flex flex-col items-center gap-3 p-6 rounded-xl transition-colors hover:bg-[var(--app-bg-hover)] group"
          >
            <div className="w-16 h-16 flex items-center justify-center text-4xl rounded-xl bg-[var(--app-bg-primary)] border border-[var(--app-border)] group-hover:border-[var(--app-accent)] transition-colors">
              {p.icon}
            </div>
            <span className="text-sm text-[var(--app-text-secondary)] group-hover:text-[var(--app-text-primary)] transition-colors">
              {p.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
