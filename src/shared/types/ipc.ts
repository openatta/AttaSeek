/**
 * IPC channel types shared between main process and preload/renderer.
 */

/** Directory entry returned by fs:read-dir */
export interface DirEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  mime?: string
}

/** File status from git:status */
export interface GitFileStatus {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  staged: boolean
  additions: number
  deletions: number
}

/** Diff file from git:diff */
export interface GitDiffFile {
  path: string
  status: string
  additions: number
  deletions: number
  hunks: GitHunk[]
  oldContent: string
  newContent: string
}

export interface GitHunk {
  header: string
  lines: string[]
}

/** Commit from git:log */
export interface GitCommit {
  hash: string
  shortHash: string
  message: string
  author: string
  date: number
}

/** Project metadata stored in global projects.json */
export interface ProjectInfo {
  id: string
  name: string
  rootPath: string
  createdAt: number
}
