/**
 * GitPanel — inline git status, stage, commit for the active project.
 *
 * Shown in the project sidebar when a project is selected and has a git repo.
 */

import { useState, useEffect, useCallback } from 'react'
import { GitBranch, Plus, Minus, Check } from 'lucide-react'
import { getApi } from '../../utils/api'
import type { GitFileStatus } from '../../../shared/types/ipc'

interface Props {
  projectRoot: string
}

export default function GitPanel({ projectRoot }: Props) {
  const [branch, setBranch] = useState<string | null>(null)
  const [files, setFiles] = useState<GitFileStatus[]>([])
  const [expanded, setExpanded] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(() => {
    const api = getApi()
    api.git.status(projectRoot).then(r => {
      if (r.success) {
        setBranch(r.branch || null)
        setFiles(r.changedFiles || [])
      }
    }).catch(() => { setError('Git not available') })
  }, [projectRoot])

  useEffect(() => { refresh() }, [refresh])

  const handleStage = async (filePath: string) => {
    const api = getApi()
    const r = await api.git.stage(projectRoot, [filePath])
    if (r.success) refresh()
  }

  const handleUnstage = async (filePath: string) => {
    const api = getApi()
    const r = await api.git.unstage(projectRoot, [filePath])
    if (r.success) refresh()
  }

  const handleCommit = async () => {
    if (!commitMsg.trim()) return
    setCommitting(true); setError('')
    const api = getApi()
    const r = await api.git.commit(projectRoot, commitMsg.trim())
    setCommitting(false)
    if (r.success) { setCommitMsg(''); refresh() }
    else setError(r.error || 'Commit failed')
  }

  const changedCount = files.length
  const stagedCount = files.filter(f => f.staged).length

  if (!branch) return null

  return (
    <div className="px-2 pb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-hover)] transition-colors"
      >
        <GitBranch className="w-3 h-3" />
        <span className="flex-1 text-left truncate">{branch}</span>
        {changedCount > 0 && (
          <span className="text-[10px] bg-[var(--app-accent)] text-white rounded-full px-1.5 py-0.5 leading-none">
            {changedCount}
          </span>
        )}
      </button>

      {expanded && (
        <div className="ml-2 mt-1 space-y-1">
          {files.length === 0 ? (
            <p className="text-[10px] text-[var(--app-text-dim)] px-2 py-1">Working tree clean</p>
          ) : (
            <>
              {files.map(f => (
                <div key={f.path} className="flex items-center gap-1 px-2 py-0.5 text-[10px] group">
                  <span className={`flex-shrink-0 w-1 h-1 rounded-full ${
                    f.status === 'added' ? 'bg-green-500' :
                    f.status === 'deleted' ? 'bg-red-500' :
                    f.status === 'untracked' ? 'bg-yellow-500' :
                    'bg-yellow-400'
                  }`} />
                  <span className="flex-1 truncate text-[var(--app-text-secondary)]">{f.path}</span>
                  {f.staged ? (
                    <button onClick={() => { void handleUnstage(f.path) }} className="opacity-0 group-hover:opacity-100 text-[var(--app-text-dim)] hover:text-[var(--app-text)]" title="Unstage">
                      <Minus className="w-3 h-3" />
                    </button>
                  ) : (
                    <button onClick={() => { void handleStage(f.path) }} className="opacity-0 group-hover:opacity-100 text-[var(--app-text-dim)] hover:text-[var(--app-accent)]" title="Stage">
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}

              {/* Commit input */}
              {stagedCount > 0 && (
                <div className="pt-2 space-y-1">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={commitMsg}
                      onChange={e => setCommitMsg(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { void handleCommit() } }}
                      placeholder={`Commit ${stagedCount} staged file(s)...`}
                      className="flex-1 bg-[var(--app-bg-inset)] border border-[var(--app-border)] rounded px-2 py-1 text-[10px] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    />
                    <button
                      onClick={() => { void handleCommit() }}
                      disabled={committing || !commitMsg.trim()}
                      className="px-2 py-1 rounded bg-[var(--app-accent)] text-white text-[10px] disabled:opacity-50 hover:opacity-90 transition-opacity"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                  {error && <p className="text-[10px] text-[var(--app-error)]">{error}</p>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
