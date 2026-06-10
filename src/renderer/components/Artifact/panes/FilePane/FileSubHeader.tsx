/**
 * FileSubHeader — secondary bar below AP title bar in FilePane.
 * Shows root path (read-only) and Explorer visibility toggle.
 */

import { PanelRightClose, PanelRightOpen } from 'lucide-react'

interface FileSubHeaderProps {
  rootPath: string
  explorerVisible: boolean
  onToggleExplorer: () => void
}

export default function FileSubHeader({ rootPath, explorerVisible, onToggleExplorer }: FileSubHeaderProps) {
  return (
    <div className="flex items-center h-[28px] px-2 border-b border-[var(--app-border)] flex-shrink-0 bg-[var(--app-bg)] text-xs gap-2">
      {/* Root path — display only */}
      <div className="flex-1 min-w-0 truncate text-[var(--app-text-secondary)] select-none">
        {rootPath || 'No folder open'}
      </div>

      {/* Explorer toggle */}
      <button
        onClick={onToggleExplorer}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] transition-colors"
        title={explorerVisible ? 'Hide Explorer' : 'Show Explorer'}
      >
        {explorerVisible ? (
          <PanelRightClose className="w-3.5 h-3.5" />
        ) : (
          <PanelRightOpen className="w-3.5 h-3.5" />
        )}
        <span>{explorerVisible ? '' : 'Explorer'}</span>
      </button>
    </div>
  )
}
