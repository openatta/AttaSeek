/**
 * CommitHistory — scrollable commit list with expand-on-click diff viewer.
 *
 * Each commit shows: short SHA, message, author, date.
 * Clicking a commit expands it to show a full diff (via git:show IPC).
 */

import { useState, useCallback } from 'react'
import { getApi } from '../../../../utils/api'

interface Commit {
  hash: string
  shortHash: string
  message: string
  author: string
  date: number
}

interface CommitHistoryProps {
  commits: Commit[]
  repoPath: string
  onSelectCommit?: (hash: string) => void
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CommitHistory({ commits, repoPath, onSelectCommit }: CommitHistoryProps) {
  const [expandedHash, setExpandedHash] = useState<string | null>(null)
  const [diffContent, setDiffContent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const toggleCommit = useCallback(async (hash: string) => {
    if (expandedHash === hash) {
      setExpandedHash(null)
      setDiffContent('')
      return
    }

    setExpandedHash(hash)
    setLoading(true)
    onSelectCommit?.(hash)

    try {
      const api = getApi()
      if (api?.git && repoPath) {
        const result = await api.git.show(repoPath, hash)
        if (result.success && result.diff) {
          setDiffContent(result.diff)
        }
      } else {
        setDiffContent('(No repository path configured)')
      }
    } catch {
      setDiffContent('(Unable to load diff)')
    } finally {
      setLoading(false)
    }
  }, [expandedHash, onSelectCommit, repoPath])

  return (
    <div className="flex flex-col">
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--app-text-tertiary)] border-b border-[var(--app-border)]">
        Commit History
      </div>
      <div className="overflow-y-auto max-h-[300px]">
        {commits.length === 0 ? (
          <div className="p-3 text-xs text-[var(--app-text-tertiary)] text-center">No commits</div>
        ) : (
          commits.map((c) => (
            <div key={c.hash} className="border-b border-[var(--app-border)] last:border-b-0">
              <div
                onClick={() => toggleCommit(c.hash)}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[var(--app-bg-hover)] transition-colors ${
                  expandedHash === c.hash ? 'bg-[var(--app-bg-hover)]' : ''
                }`}
              >
                <span className="text-[10px] font-mono text-[var(--app-accent)] flex-shrink-0">{c.shortHash}</span>
                <span className="text-xs text-[var(--app-text-primary)] truncate flex-1">{c.message}</span>
                <span className="text-[10px] text-[var(--app-text-tertiary)] flex-shrink-0">{c.author}</span>
                <span className="text-[10px] text-[var(--app-text-tertiary)] flex-shrink-0">{formatDate(c.date)}</span>
              </div>

              {expandedHash === c.hash && (
                <div className="px-3 pb-2">
                  {loading ? (
                    <div className="text-xs text-[var(--app-text-tertiary)] py-2">Loading diff...</div>
                  ) : (
                    <pre className="text-[11px] font-mono text-[var(--app-text-secondary)] overflow-x-auto whitespace-pre bg-[var(--app-bg-primary)] p-2 rounded max-h-[200px] overflow-y-auto">
                      {diffContent || '(No diff content)'}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
