/**
 * CacheBreakDetector — detects unexpected prompt cache misses.
 *
 * Compares the current request's cache-relevant state (system prompt hash,
 * tool definitions hash, model ID, fast-mode status) with the previous
 * request's state. When state changes, the cache breaks — this detector
 * logs diagnostics to help identify the cause.
 *
 * Mirrors Claude Code's promptCacheBreakDetection.ts.
 */

import crypto from 'crypto'

// ── Types ──

export interface CacheState {
  /** SHA-256 hash of the system prompt (first 16 chars). */
  systemPromptHash: string
  /** SHA-256 hash of tool names + descriptions (first 16 chars). */
  toolsHash: string
  /** Model identifier. */
  modelId: string
  /** Character count of all messages combined. */
  messageCharCount: number
  /** Whether fast mode (streaming) was active. */
  isFastMode: boolean
  /** Query source identifier (e.g., 'repl_main_thread', 'agent:explore'). */
  querySource: string
  /** Timestamp when this state was captured. */
  capturedAt: number
}

export interface CacheBreakDiagnostic {
  /** Whether the cache was expected to break (state changed). */
  expected: boolean
  /** Which fields changed from the previous state. */
  changedFields: string[]
  /** Previous and current state for comparison. */
  previous: CacheState | null
  current: CacheState
}

// ── Implementation ──

export class CacheBreakDetector {
  private previousState: CacheState | null = null
  private breakCount = 0

  /**
   * Capture the current request state for cache comparison.
   */
  capture(params: {
    systemPrompt: string
    tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>
    modelId: string
    messageCharCount: number
    isFastMode: boolean
    querySource: string
  }): CacheState {
    const state: CacheState = {
      systemPromptHash: crypto.createHash('sha256').update(params.systemPrompt).digest('hex').slice(0, 16),
      toolsHash: crypto.createHash('sha256')
        .update(params.tools.map(t => `${t.name}:${t.description}`).sort().join('|'))
        .digest('hex').slice(0, 16),
      modelId: params.modelId,
      messageCharCount: params.messageCharCount,
      isFastMode: params.isFastMode,
      querySource: params.querySource,
      capturedAt: Date.now(),
    }
    return state
  }

  /**
   * Compare current state with previous and return diagnostics.
   * Call this AFTER receiving the API response to check if cache broke.
   */
  diagnose(current: CacheState): CacheBreakDiagnostic {
    const previous = this.previousState
    this.previousState = current

    if (!previous) {
      return { expected: true, changedFields: ['initial'], previous: null, current }
    }

    const changedFields: string[] = []

    if (previous.systemPromptHash !== current.systemPromptHash) {
      changedFields.push('systemPrompt')
    }
    if (previous.toolsHash !== current.toolsHash) {
      changedFields.push('tools')
    }
    if (previous.modelId !== current.modelId) {
      changedFields.push('modelId')
    }
    if (previous.isFastMode !== current.isFastMode) {
      changedFields.push('fastMode')
    }
    if (previous.querySource !== current.querySource) {
      changedFields.push('querySource')
    }

    const expected = changedFields.length > 0

    if (!expected) {
      // Same state but cache still broke — unexpected
      this.breakCount++
      changedFields.push(`unexpected_break_#${this.breakCount}`)
    }

    return { expected, changedFields, previous, current }
  }

  /**
   * Log a diagnostic summary. Call after diagnose() returns unexpected=true.
   */
  logDiagnostic(diagnostic: CacheBreakDiagnostic): void {
    if (diagnostic.expected && !diagnostic.changedFields.includes('unexpected_break')) {
      // Expected change — normal, don't log
      return
    }

    const changes = diagnostic.changedFields.join(', ')
    console.warn(
      `[CacheBreak] ${diagnostic.expected ? 'expected' : 'UNEXPECTED'} cache break — ` +
      `changes: [${changes}] — ` +
      `prev: ${diagnostic.previous?.modelId ?? 'none'}@${diagnostic.previous?.systemPromptHash ?? 'none'} — ` +
      `curr: ${diagnostic.current.modelId}@${diagnostic.current.systemPromptHash}`,
    )
  }

  /** Reset tracking state (e.g., on session reset). */
  reset(): void {
    this.previousState = null
    this.breakCount = 0
  }
}

/** Singleton instance. */
export const cacheBreakDetector = new CacheBreakDetector()
