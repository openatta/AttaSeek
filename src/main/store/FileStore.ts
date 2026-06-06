/**
 * FileStore — generic plain-text file storage for Markdown, JSON, JSONL.
 *
 * Three formats:
 *   MarkdownStore — .md files with YAML frontmatter (for memories, skills)
 *   JSONStore     — .json files (for settings)
 *   JSONLStore    — .jsonl files, stream-append (for session events)
 */

import * as fsp from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

// ── MarkdownStore ──

export interface MarkdownEntry {
  content: string
  metadata: Record<string, unknown>
  updatedAt: number
}

export class MarkdownStore {
  constructor(private baseDir: string) {}

  private filePath(name: string): string { return `${this.baseDir}/${name}.md` }

  async read(name: string): Promise<MarkdownEntry | null> {
    try {
      const raw = await fsp.readFile(this.filePath(name), 'utf-8')
      const stat = await fsp.stat(this.filePath(name))
      return { content: raw, metadata: parseFrontmatter(raw), updatedAt: stat.mtimeMs }
    } catch { return null }
  }

  async write(name: string, content: string): Promise<void> {
    const fp = this.filePath(name)
    const dir = dirname(fp)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    await fsp.writeFile(fp, content, 'utf-8')
  }

  async list(): Promise<string[]> {
    try {
      const files = await fsp.readdir(this.baseDir)
      return files.filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''))
    } catch { return [] }
  }

  async delete(name: string): Promise<void> { try { await fsp.unlink(this.filePath(name)) } catch { /* ignore */ } }
}

// ── JSONStore ──

export class JSONStore<T extends Record<string, unknown>> {
  private cache: T | null = null
  private cacheMtime = 0

  constructor(private filePath: string) {}

  async read(): Promise<T> {
    try {
      const stat = await fsp.stat(this.filePath)
      if (this.cache && stat.mtimeMs <= this.cacheMtime) return this.cache
      const raw = await fsp.readFile(this.filePath, 'utf-8')
      this.cache = JSON.parse(raw) as T
      this.cacheMtime = stat.mtimeMs
      return this.cache!
    } catch { return {} as T }
  }

  async write(data: T): Promise<void> {
    const dir = dirname(this.filePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const raw = JSON.stringify(data, null, 2)
    await fsp.writeFile(this.filePath, raw, 'utf-8')
    this.cache = data
    this.cacheMtime = Date.now()
  }

  invalidate(): void { this.cache = null; this.cacheMtime = 0 }
}

// ── JSONLStore ──

export class JSONLStore {
  constructor(private filePath: string) {}

  async append(event: unknown): Promise<void> {
    const dir = dirname(this.filePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    await fsp.appendFile(this.filePath, JSON.stringify(event) + '\n', 'utf-8')
  }

  async *read(): AsyncGenerator<unknown, void, void> {
    try {
      const raw = await fsp.readFile(this.filePath, 'utf-8')
      for (const line of raw.split('\n')) {
        if (line.trim()) { try { yield JSON.parse(line) } catch { /* skip malformed */ } }
      }
    } catch { /* file not found */ }
  }

  async readAll(): Promise<unknown[]> {
    const result: unknown[] = []
    for await (const e of this.read()) result.push(e)
    return result
  }
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
