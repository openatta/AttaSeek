/**
 * ReviewSubHeader — Codex-aligned Git review pane sub-header.
 *
 * Layout:
 * [branch ▾] | [scope ▾]              Staged(N)  Unstaged(M)
 *                                      [Stage All] [Revert All]
 */

interface ReviewSubHeaderProps {
  branch: string
  branches: string[]
  scope: 'uncommitted' | 'branch' | 'lastTurn'
  stagedCount: number
  unstagedCount: number
  onBranchChange: (branch: string) => void
  onScopeChange: (scope: 'uncommitted' | 'branch' | 'lastTurn') => void
  onStageAll: () => void
  onRevertAll: () => void
}

const SCOPE_LABELS: Record<string, string> = {
  uncommitted: '未提交变更',
  branch: '全部分支变更',
  lastTurn: '上轮变更',
}

export default function ReviewSubHeader({
  branch, branches, scope, stagedCount, unstagedCount,
  onBranchChange, onScopeChange, onStageAll, onRevertAll,
}: ReviewSubHeaderProps) {
  return (
    <div className="flex items-center h-[30px] px-2 gap-2 border-b border-[var(--app-border)] flex-shrink-0 bg-[var(--app-bg)] text-xs">
      {/* Branch selector */}
      <select
        value={branch}
        onChange={(e) => onBranchChange(e.target.value)}
        className="h-[22px] px-1 text-[11px] bg-[var(--app-bg-primary)] border border-[var(--app-border)] rounded text-[var(--app-text-primary)] outline-none max-w-[140px]"
        title="Branch"
      >
        {branches.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>

      <span className="text-[var(--app-text-tertiary)]">|</span>

      {/* Scope selector */}
      <select
        value={scope}
        onChange={(e) => onScopeChange(e.target.value as typeof scope)}
        className="h-[22px] px-1 text-[11px] bg-[var(--app-bg-primary)] border border-[var(--app-border)] rounded text-[var(--app-text-primary)] outline-none"
        title="Scope"
      >
        {(['uncommitted', 'branch', 'lastTurn'] as const).map((s) => (
          <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
        ))}
      </select>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Staged / Unstaged counts */}
      <span className="text-[var(--app-accent)]">Staged({stagedCount})</span>
      <span className="text-[var(--app-text-tertiary)]">Unstaged({unstagedCount})</span>

      {/* Actions */}
      <button
        onClick={onStageAll}
        className="px-2 py-0.5 rounded text-[11px] text-[var(--app-accent)] hover:bg-[var(--app-accent)]/10 transition-colors"
      >
        Stage All
      </button>
      <button
        onClick={onRevertAll}
        className="px-2 py-0.5 rounded text-[11px] text-[var(--app-error)] hover:bg-[var(--app-error)]/10 transition-colors"
      >
        Revert All
      </button>
    </div>
  )
}
