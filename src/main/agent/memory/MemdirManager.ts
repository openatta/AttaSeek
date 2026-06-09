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
const MAX_RELEVANT_MEMORIES = 5
const RELEVANCE_CACHE_TTL_MS = 300_000 // 5 min

// ── Relevance cache ──

interface RelevanceCacheEntry {
  queryHash: string
  relevantEntries: MemoryIndexEntry[]
  timestamp: number
}

const relevanceCache = new Map<string, RelevanceCacheEntry>()

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

/**
 * Select the top-K most relevant memory entries for a given query.
 *
 * Uses two strategies:
 *   1. Heuristic (default, no LLM cost): keyword overlap scoring
 *   2. LLM-powered (opt-in, via findRelevantMemoriesLLM): uses small_fast
 *      model to rank memories by relevance to the current goal + context.
 *
 * @param goal — the current task goal
 * @param context — recent conversation context (last few messages)
 * @param entries — all available memory index entries
 * @param k — max entries to return (default 5)
 */
export function findRelevantMemories(
  goal: string,
  context: string,
  entries: MemoryIndexEntry[],
  k = MAX_RELEVANT_MEMORIES,
): MemoryIndexEntry[] {
  if (entries.length <= k) return entries

  // Heuristic: keyword-based relevance scoring
  const goalTerms = goal.toLowerCase().split(/\s+/).filter(t => t.length > 2)
  const contextTerms = context.toLowerCase().split(/\s+/).filter(t => t.length > 2)
  const allTerms = [...new Set([...goalTerms, ...contextTerms])]

  if (allTerms.length === 0) return entries.slice(0, k)

  const scored = entries.map(entry => {
    const text = `${entry.name} ${entry.description}`.toLowerCase()
    let score = 0
    for (const term of allTerms) {
      if (text.includes(term)) score += 1
      // Bonus for exact word match
      if (new RegExp(`\\b${term}\\b`).test(text)) score += 2
    }
    return { entry, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k).filter(s => s.score > 0).map(s => s.entry)
}

/**
 * LLM-powered relevance selection for higher accuracy.
 *
 * Uses the small_fast model to rank memory entries by relevance
 * to the current goal. More accurate than keyword matching but
 * incurs an API call cost. Results are cached per queryHash.
 *
 * @param goal — current task goal
 * @param recentContext — truncated recent conversation (max 500 chars)
 * @param entries — all available memory entries
 * @param model — the small/fast model to use
 * @param k — max entries to return (default 5)
 */
export async function findRelevantMemoriesLLM(
  goal: string,
  recentContext: string,
  entries: MemoryIndexEntry[],
  model: string,
  k = MAX_RELEVANT_MEMORIES,
): Promise<MemoryIndexEntry[]> {
  if (entries.length <= k) return entries

  // Check cache
  const queryHash = hashQuery(goal + recentContext)
  const cached = relevanceCache.get(queryHash)
  if (cached && (Date.now() - cached.timestamp) < RELEVANCE_CACHE_TTL_MS) {
    return cached.relevantEntries
  }

  try {
    const { modelProviderRegistry } = await import('../llm/ModelProviderRegistry')
    const provider = modelProviderRegistry.getDefault()
    if (!provider) throw new Error('No provider')

    const memoryList = entries.map((e, i) =>
      `${i + 1}. [${e.type}] **${e.name}**: ${e.description}`
    ).join('\n')

    const systemPrompt = `You are a memory relevance ranker. Given a task goal and a list of available memories, select the ${k} MOST relevant memories. Return ONLY the numbers of the selected memories, one per line. Do not explain.`

    const result = await provider.chat({
      systemPrompt,
      messages: [{
        role: 'user',
        content: `Goal: ${goal}\n\nContext: ${recentContext.slice(0, 500)}\n\nAvailable memories:\n${memoryList}\n\nSelect the ${k} most relevant (by number):`,
      }],
      tools: [],
      model,
    })

    const text = result.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('\n')

    // Parse numbered selections
    const selected = text.match(/\d+/g)?.map(Number).filter(n => n >= 1 && n <= entries.length) ?? []
    const unique = [...new Set(selected)].slice(0, k)
    const relevant = unique.map(i => entries[i - 1])

    // Cache
    relevanceCache.set(queryHash, { queryHash, relevantEntries: relevant, timestamp: Date.now() })

    return relevant
  } catch {
    // Fall back to heuristic relevance
    return findRelevantMemories(goal, recentContext, entries, k)
  }
}

/** Simple hash for cache key (deterministic, no crypto needed). */
function hashQuery(query: string): string {
  let hash = 0
  for (let i = 0; i < query.length; i++) {
    const char = query.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
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
