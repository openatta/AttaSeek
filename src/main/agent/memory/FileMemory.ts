/**
 * FileMemory — File-system based persistent memory (L0 layer).
 *
 * Loads CLAUDE.md and .atta/seek/memories/*.md from the project root.
 * Markdown files with optional YAML frontmatter for metadata.
 *
 * Inspired by Claude Code's memdir/ system.
 */

import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'
import type { MemoryEntry, MemoryType, MemoryScope } from '../../../shared/types/Memory'

export interface FileMemoryEntry {
  filePath: string
  content: string
  metadata: Record<string, unknown>
  updatedAt: number
}

/** Load all memory files from a project directory (async) */
export async function loadFileMemories(projectRoot: string): Promise<FileMemoryEntry[]> {
  const entries: FileMemoryEntry[] = []

  // Load CLAUDE.md
  const claudeMd = path.join(projectRoot, 'CLAUDE.md')
  try {
    const content = await fsp.readFile(claudeMd, 'utf-8')
    const stat = await fsp.stat(claudeMd)
    entries.push({
      filePath: claudeMd, content,
      metadata: parseFrontmatter(content),
      updatedAt: stat.mtimeMs,
    })
  } catch { /* file not found — skip */ }

  // Load .atta/seek/memories/*.md
  const memDir = path.join(projectRoot, '.atta', 'seek', 'memories')
  try {
    const files = await fsp.readdir(memDir)
    const mdFiles = files.filter(f => f.endsWith('.md'))
    const fileResults = await Promise.all(mdFiles.map(async (file) => {
      const fp = path.join(memDir, file)
      try {
        const content = await fsp.readFile(fp, 'utf-8')
        const stat = await fsp.stat(fp)
        return { filePath: fp, content, metadata: parseFrontmatter(content), updatedAt: stat.mtimeMs }
      } catch { return null }
    }))
    for (const r of fileResults) { if (r) entries.push(r) }
  } catch { /* dir not found — skip */ }

  return entries.sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Convert file memory entries to MemoryEntry format */
export function toMemoryEntries(
  fileEntries: FileMemoryEntry[],
  scope: MemoryScope = 'project',
  scopeId: string = '',
): MemoryEntry[] {
  return fileEntries.map((fe, i) => ({
    id: `filemem_${i}`,
    content: fe.content,
    type: (fe.metadata.type as MemoryType) || 'user_preference',
    scope,
    scopeId: fe.metadata.scopeId as string || scopeId,
    source: 'file_system' as const,
    layer: 'L0' as const,
    createdAt: fe.updatedAt,
    updatedAt: fe.updatedAt,
  }))
}

// ── Helpers ──

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const meta: Record<string, unknown> = {}
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (kv) meta[kv[1]] = kv[2].trim()
  }
  return meta
}
