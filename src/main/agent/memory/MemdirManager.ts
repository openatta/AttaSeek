/**
 * MemdirManager — MEMORY.md index and memory file management.
 *
 * Reads the MEMORY.md index file at the project root, providing
 * structured access to typed memory entries with frontmatter parsing.
 *
 * Inspired by Claude Code's memdir/memdir.ts MEMORY.md pattern.
 */

import * as fs from 'fs'
import * as path from 'path'

export type MemoryType = 'user' | 'feedback' | 'project' | 'reference'

export interface MemoryIndexEntry {
  name: string           // kebab-case slug (filename without .md)
  description: string    // one-line summary for relevance judgment
  type: MemoryType
  file: string           // relative path to the .md file
}

export interface MemoryPrompt {
  /** Formatted memory content for system prompt injection */
  content: string
  /** List of memory entry files loaded */
  entries: MemoryIndexEntry[]
  /** MEMORY.md index content (truncated) */
  indexContent: string
}

const MAX_INDEX_BYTES = 8000
const MAX_ENTRY_BYTES = 4000

/**
 * Load the MEMORY.md index and build a memory prompt.
 * Looks for MEMORY.md in the project root (and .claude/memory/ directory).
 */
export function loadMemoryPrompt(projectRoot?: string): MemoryPrompt {
  const root = projectRoot || process.cwd()
  const indexPaths = [
    path.join(root, 'MEMORY.md'),
    path.join(root, '.claude', 'memory', 'MEMORY.md'),
  ]

  let indexContent = ''
  for (const p of indexPaths) {
    try {
      indexContent = fs.readFileSync(p, 'utf-8')
      break
    } catch { /* file may not exist */ }
  }

  const truncatedIndex = indexContent.slice(0, MAX_INDEX_BYTES)
  const entries = parseMemoryIndex(truncatedIndex, root)

  // Load individual memory entry files
  const entryContents: string[] = []
  for (const entry of entries.slice(0, 20)) {
    try {
      const content = fs.readFileSync(entry.file, 'utf-8')
      entryContents.push(`### ${entry.name}\n${content.slice(0, MAX_ENTRY_BYTES)}`)
    } catch { /* skip unreadable entries */ }
  }

  return {
    content: entryContents.length > 0
      ? ['## Memory', ...entryContents].join('\n\n')
      : '',
    entries,
    indexContent: truncatedIndex,
  }
}

/** Parse MEMORY.md index into structured entries */
function parseMemoryIndex(indexContent: string, root: string): MemoryIndexEntry[] {
  const entries: MemoryIndexEntry[] = []
  const lines = indexContent.split('\n')

  for (const line of lines) {
    // Format: - [Title](path/to/file.md) — description
    const match = line.match(/^-\s+\[([^\]]+)\]\(([^)]+)\)\s*[-—]\s*(.+)$/)
    if (!match) continue

    const [, name, filePath, description] = match
    const type = inferMemoryType(description)

    entries.push({
      name,
      description: description.trim(),
      type,
      file: path.resolve(root, filePath),
    })
  }

  return entries
}

function inferMemoryType(description: string): MemoryType {
  const lower = description.toLowerCase()
  if (lower.includes('preference') || lower.includes('expertise') || lower.includes('role')) return 'user'
  if (lower.includes('feedback') || lower.includes('correction') || lower.includes('confirmed')) return 'feedback'
  if (lower.includes('project') || lower.includes('ongoing') || lower.includes('constraint')) return 'project'
  if (lower.includes('reference') || lower.includes('url') || lower.includes('pointer')) return 'reference'
  return 'project'
}

/** Ensure the memory directory exists */
export function ensureMemoryDir(projectRoot?: string): string {
  const root = projectRoot || process.cwd()
  const memDir = path.join(root, '.claude', 'memory')
  if (!fs.existsSync(memDir)) {
    fs.mkdirSync(memDir, { recursive: true })
  }
  return memDir
}
