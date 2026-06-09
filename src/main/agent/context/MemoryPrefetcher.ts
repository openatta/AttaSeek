/**
 * MemoryPrefetcher — asynchronous memory context pre-loading.
 *
 * Starts memory loading (CLAUDE.md, .atta/seek/memories, SQLite recall)
 * at the beginning of a query turn and lets the LLM call proceed in
 * parallel. The prefetch result is consumed at turn end (for the next
 * iteration's context assembly) or during hook execution.
 *
 * Mirrors Claude Code's startRelevantMemoryPrefetch (src/utils/attachments.ts).
 *
 * Key design:
 *   - `start()` returns immediately — the actual loading runs async
 *   - `settledAt` resolves when all memory sources are loaded
 *   - `dispose()` is called on all exit paths (using Symbol.dispose or manual)
 *   - If the LLM call finishes before prefetch, wait for settledAt
 *   - If prefetch finishes first, results are immediately available
 */

import { loadFileMemories, toMemoryEntries } from '../memory/FileMemory'
import { memoryService } from '../../memory/MemoryService'
import type { LLMMessage } from '../llm/ModelProvider'
import type { MemoryEntry } from '../../../shared/types/Memory'

// ── Types ──

export interface MemoryPrefetchResult {
  /** Messages to inject into the LLM context (memory context blocks). */
  messages: LLMMessage[]
  /** Raw memory entries for prompt section assembly. */
  entries: MemoryEntry[]
  /** Total token estimate. */
  tokenEstimate: number
}

export interface MemoryPrefetch {
  /** Promise that resolves when all memory sources finish loading. */
  settledAt: Promise<void>
  /** Synchronously available result (empty until settledAt resolves). */
  result: MemoryPrefetchResult
  /** Cleanup — call on all exit paths. */
  dispose: () => void
  /** Whether the prefetch has settled (resolved or rejected). */
  isSettled: boolean
}

export interface MemoryPrefetchConfig {
  /** Session identifier. */
  sessionId: string
  /** Project root (for CLAUDE.md file discovery). */
  projectId?: string
  /** Query goal for relevance-based recall. */
  query?: string
  /** Maximum memory entries to recall from SQLite. */
  recallLimit: number
  /** Whether to load file-system memories (CLAUDE.md, etc.). */
  loadFileMemories: boolean
}

const DEFAULT_CONFIG: Partial<MemoryPrefetchConfig> = {
  recallLimit: 10,
  loadFileMemories: true,
}

// ── Core ──

/**
 * Start asynchronous memory prefetch.
 *
 * Returns immediately — the caller can proceed with context assembly
 * and LLM invocation while memory loads in the background.
 *
 * @param config — what to prefetch
 * @returns MemoryPrefetch handle (must call dispose() on all exit paths)
 */
export function startMemoryPrefetch(
  config: MemoryPrefetchConfig,
): MemoryPrefetch {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const result: MemoryPrefetchResult = { messages: [], entries: [], tokenEstimate: 0 }
  let isSettled = false
  let settledResolve!: () => void
  let disposed = false

  const settledAt = new Promise<void>((resolve) => {
    settledResolve = resolve
  })

  // Launch async loading
  const loadPromise = (async () => {
    if (disposed) return
    try {
      const entries: MemoryEntry[] = []

      // L2: SQLite memory recall
      if (cfg.recallLimit > 0) {
        try {
          const recalled = await memoryService.recall({
            scopeId: cfg.projectId || cfg.sessionId,
            limit: cfg.recallLimit,
            query: cfg.query,
          })
          entries.push(...recalled)
        } catch {
          // SQLite may not be available (tests, early startup)
        }
      }

      // L0: File system memory (CLAUDE.md + .atta/seek/memories)
      if (cfg.loadFileMemories && cfg.projectId) {
        try {
          const fileEntries = await loadFileMemories(cfg.projectId)
          if (fileEntries.length > 0) {
            const memEntries = toMemoryEntries(fileEntries, 'project', cfg.projectId)
            entries.push(...memEntries)
          }
        } catch {
          // File memory is best-effort
        }
      }

      // Build context messages from entries
      if (entries.length > 0) {
        const memoryText = entries
          .map(e => `- [${e.type}] ${e.content.slice(0, 500)}`)
          .join('\n')
        result.messages.push({
          role: 'user',
          content: `## Relevant Context\n${memoryText}`,
        })
        result.entries = entries
        result.tokenEstimate = Math.ceil(memoryText.length / 4)
      }
    } catch {
      // Prefetch failure is non-fatal — result stays empty
    } finally {
      if (!disposed) {
        isSettled = true
        settledResolve()
      }
    }
  })()

  return {
    settledAt,
    result,
    dispose: () => {
      disposed = true
      isSettled = true
      settledResolve()
    },
    get isSettled() {
      return isSettled
    },
  }
}

/**
 * Consume the prefetch result, waiting for it to settle if necessary.
 * Called at turn end (before next iteration's context assembly).
 *
 * @param prefetch — the prefetch handle from startMemoryPrefetch
 * @returns the loaded memory context
 */
export async function consumeMemoryPrefetch(
  prefetch: MemoryPrefetch,
): Promise<MemoryPrefetchResult> {
  try {
    await prefetch.settledAt
  } catch {
    // Timeout or disposal — return whatever we have
  }
  return prefetch.result
}

/**
 * Check if the prefetch has new memory entries that should trigger
 * a re-extraction cycle.
 */
export function hasNewMemories(prefetch: MemoryPrefetch): boolean {
  return prefetch.isSettled && prefetch.result.entries.length > 0
}
