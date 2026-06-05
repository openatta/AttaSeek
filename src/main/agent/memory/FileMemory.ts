/**
 * FileMemory — File-system based persistent memory (L0 layer).
 *
 * Loads CLAUDE.md and .attaseek/memory/*.md from the project root.
 * Markdown files with optional YAML frontmatter for metadata.
 *
 * Inspired by Claude Code's memdir/ system.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { MemoryEntry, MemoryType, MemoryScope } from '../../../shared/types/Memory'

export interface FileMemoryEntry {
  filePath: string
  content: string
  metadata: Record<string, unknown>
  updatedAt: number
}

/** Load all memory files from a project directory */
export function loadFileMemories(projectRoot: string): FileMemoryEntry[] {
  const entries: FileMemoryEntry[] = []

  // Load CLAUDE.md
  const claudeMd = path.join(projectRoot, 'CLAUDE.md')
  if (fs.existsSync(claudeMd)) {
    const content = fs.readFileSync(claudeMd, 'utf-8')
    entries.push({
      filePath: claudeMd,
      content,
      metadata: parseFrontmatter(content),
      updatedAt: fs.statSync(claudeMd).mtimeMs,
    })
  }

  // Load .attaseek/memory/*.md
  const memDir = path.join(projectRoot, '.attaseek', 'memory')
  if (fs.existsSync(memDir)) {
    for (const file of fs.readdirSync(memDir)) {
      if (!file.endsWith('.md')) continue
      const fp = path.join(memDir, file)
      const content = fs.readFileSync(fp, 'utf-8')
      entries.push({
        filePath: fp,
        content,
        metadata: parseFrontmatter(content),
        updatedAt: fs.statSync(fp).mtimeMs,
      })
    }
  }

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
