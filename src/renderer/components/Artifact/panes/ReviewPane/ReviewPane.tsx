/**
 * ReviewPane — Codex-aligned Git review pane.
 *
 * Shows git diff (staged/unstaged), supports scope selection,
 * file-by-file diff view, staging/reverting, commit, and commit history.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import { projectRootAtom } from '../../ApAtoms'
import type { PaneProps } from '../../PaneRegistry'
import type { GitFileStatus, GitDiffFile, GitCommit } from '../../../../../shared/types/ipc'
import { getApi } from '../../../../utils/api'
import ReviewSubHeader from './ReviewSubHeader'
import DiffView from './DiffView'
import CommitHistory from './CommitHistory'

export default function ReviewPane(_props: PaneProps) {
  const projectRoot = useAtomValue(projectRootAtom)
  const repoPath = projectRoot || ''

  // Git state
  const [branch, setBranch] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [scope, setScope] = useState<'uncommitted' | 'branch' | 'lastTurn'>('uncommitted')
  const [changedFiles, setChangedFiles] = useState<GitFileStatus[]>([])
  const [diffFiles, setDiffFiles] = useState<GitDiffFile[]>([])
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [diffMode] = useState<'side-by-side' | 'inline'>('side-by-side')
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [commitMessage, setCommitMessage] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'no-git'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  const api = getApi()

  // Load git status
  const loadStatus = useCallback(async () => {
    if (!repoPath || !api?.git) { setStatus('no-git'); return }
    try {
      setStatus('loading')
      const [statusResult, branchResult, logResult] = await Promise.all([
        api.git.status(repoPath),
        api.git.branches(repoPath),
        api.git.log(repoPath, 20),
      ])

      if (!statusResult.success) {
        setStatus('no-git'); setErrorMsg(statusResult.error || 'Not a git repository')
        return
      }

      setBranch(statusResult.branch || '')
      setChangedFiles(statusResult.changedFiles || [])
      setBranches(branchResult.branches || [])
      setCommits(logResult.commits || [])
      setStatus('ready')
    } catch (err) {
      setStatus('error'); setErrorMsg(err instanceof Error ? err.message : 'Git error')
    }
  }, [repoPath])

  // Load diff
  const loadDiff = useCallback(async () => {
    if (!repoPath || !api?.git) return
    try {
      const staged = false // Show unstaged by default
      const result = await api.git.diff(repoPath, scope, staged)
      if (result.success && result.files) {
        setDiffFiles(result.files)
      }
    } catch { /* ignore */ }
  }, [repoPath, scope])

  useEffect(() => { loadStatus() }, [loadStatus])
  useEffect(() => { if (status === 'ready') loadDiff() }, [loadDiff, status])

  // Actions
  const handleStageAll = async () => {
    if (!repoPath || !api?.git) return
    await api.git.stage(repoPath)
    loadStatus()
  }

  const handleRevertAll = async () => {
    if (!repoPath || !api?.git) return
    await api.git.revert(repoPath)
    loadStatus()
  }

  const handleStageFile = async (filePath: string) => {
    if (!repoPath || !api?.git) return
    await api.git.stage(repoPath, [filePath])
    loadStatus()
  }

  const handleRevertFile = async (filePath: string) => {
    if (!repoPath || !api?.git) return
    await api.git.revert(repoPath, [filePath])
    loadStatus()
  }

  const handleCommit = async () => {
    if (!repoPath || !api?.git || !commitMessage.trim()) return
    const result = await api.git.commit(repoPath, commitMessage.trim())
    if (result.success) {
      setCommitMessage('')
      loadStatus()
    }
  }

  const stagedCount = changedFiles.filter((f) => f.staged).length
  const unstagedCount = changedFiles.filter((f) => !f.staged).length

  // No-git state
  if (status === 'no-git') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-sm text-[var(--app-text-tertiary)]">
          <div className="text-2xl mb-2">📊</div>
          <div>当前目录不是 Git 仓库</div>
          <div className="text-xs mt-1 opacity-50">运行 <code className="bg-[var(--app-bg-hover)] px-1 rounded">git init</code> 初始化仓库</div>
        </div>
      </div>
    )
  }

  // Loading
  if (status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--app-text-tertiary)]">
        Loading git status...
      </div>
    )
  }

  const selectedDiff = diffFiles.find((f) => f.path === selectedFilePath)

  return (
    <div className="flex flex-col h-full">
      {/* Sub-header */}
      <ReviewSubHeader
        branch={branch}
        branches={branches}
        scope={scope}
        stagedCount={stagedCount}
        unstagedCount={unstagedCount}
        onBranchChange={setBranch}
        onScopeChange={setScope}
        onStageAll={handleStageAll}
        onRevertAll={handleRevertAll}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main content: changed files + diff */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Commit message input */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message..."
              className="flex-1 h-[24px] px-2 text-xs bg-[var(--app-bg-primary)] border border-[var(--app-border)] rounded text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCommit() }}
            />
            <button
              onClick={handleCommit}
              disabled={!commitMessage.trim()}
              className="px-3 py-0.5 rounded text-xs bg-[var(--app-accent)] text-white hover:bg-[var(--app-accent)]/80 disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              Commit
            </button>
          </div>

          {/* Changed files list */}
          <div className="flex-1 overflow-y-auto">
            {changedFiles.length === 0 ? (
              <div className="p-4 text-xs text-[var(--app-text-tertiary)] text-center">
                No changes — working tree clean
              </div>
            ) : (
              changedFiles.map((file) => (
                <div key={file.path} className="border-b border-[var(--app-border)] last:border-b-0">
                  <div
                    onClick={() => setSelectedFilePath(selectedFilePath === file.path ? null : file.path)}
                    className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[var(--app-bg-hover)] transition-colors text-xs ${
                      selectedFilePath === file.path ? 'bg-[var(--app-bg-hover)]' : ''
                    }`}
                  >
                    <span className={`w-4 h-4 flex items-center justify-center rounded text-[10px] ${
                      file.status === 'added' ? 'text-[var(--app-accent)]' :
                      file.status === 'deleted' ? 'text-[var(--app-error)]' :
                      file.status === 'untracked' ? 'text-[var(--app-warning)]' :
                      'text-[var(--app-text-tertiary)]'
                    }`}>
                      {file.status === 'added' ? 'A' : file.status === 'deleted' ? 'D' : file.status === 'untracked' ? '?' : 'M'}
                    </span>
                    <span className="flex-1 truncate">{file.path}</span>
                    <span className="text-[10px] text-[var(--app-text-tertiary)]">
                      {file.staged ? 'Staged' : 'Unstaged'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStageFile(file.path) }}
                      className="px-1.5 py-0.5 rounded text-[10px] text-[var(--app-text-tertiary)] hover:text-[var(--app-accent)] hover:bg-[var(--app-bg-hover)] transition-colors"
                    >
                      {file.staged ? 'Unstage' : 'Stage'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRevertFile(file.path) }}
                      className="px-1.5 py-0.5 rounded text-[10px] text-[var(--app-text-tertiary)] hover:text-[var(--app-error)] hover:bg-[var(--app-bg-hover)] transition-colors"
                    >
                      Revert
                    </button>
                  </div>

                  {/* Expanded diff */}
                  {selectedFilePath === file.path && selectedDiff && (
                    <div className="border-t border-[var(--app-border)]" style={{ height: '300px' }}>
                      <DiffView
                        original={selectedDiff.oldContent}
                        modified={selectedDiff.newContent}
                        language={selectedFilePath?.split('.').pop() || 'plaintext'}
                        mode={diffMode}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right panel: Commit history */}
        <div className="w-[240px] flex-shrink-0 border-l border-[var(--app-border)] overflow-hidden">
          <CommitHistory commits={commits} repoPath={repoPath} />
        </div>
      </div>
    </div>
  )
}
