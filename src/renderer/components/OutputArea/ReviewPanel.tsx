import { MOCK_DIFF_FILES, type DiffFile } from '../../workspaces/mock/projects'

const STATUS_COLORS: Record<DiffFile['status'], string> = {
  modified: 'text-amber-400',
  added: 'text-green-400',
  deleted: 'text-red-400'
}

const STATUS_LABELS: Record<DiffFile['status'], string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D'
}

export default function ReviewPanel() {
  return (
    <div className="flex h-full">
      {/* Changed files list */}
      <div className="w-52 border-r border-[var(--app-border)] overflow-y-auto">
        <div className="px-3 py-2 text-[10px] text-[var(--app-text-dim)] uppercase tracking-wider">
          Changed Files
        </div>
        {MOCK_DIFF_FILES.map((f) => (
          <button
            key={f.filename}
            className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-[var(--app-bg-hover)] transition-colors"
          >
            <span className={`w-4 text-center font-mono text-[10px] ${STATUS_COLORS[f.status]}`}>
              {STATUS_LABELS[f.status]}
            </span>
            <span className="text-[var(--app-text-secondary)] truncate">{f.filename}</span>
            <span className="ml-auto text-[10px] text-[var(--app-text-dim)] flex-shrink-0">
              {f.additions > 0 && <span className="text-green-400">+{f.additions}</span>}
              {f.additions > 0 && f.deletions > 0 && ' '}
              {f.deletions > 0 && <span className="text-red-400">-{f.deletions}</span>}
            </span>
          </button>
        ))}
      </div>

      {/* Diff view */}
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-[var(--app-text-dim)]">Select a file to view diff</p>
      </div>
    </div>
  )
}
