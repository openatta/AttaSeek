/**
 * Built-in stop hooks — memory extraction + prompt suggestion.
 *
 * Registered on the Stop event via hookPipeline in boot.ts.
 * These run AFTER each turn completes (post-tool-execution).
 */

import type { HookConfig } from '../HookTypes'
import { extractMemories } from '../../memory/MemoryExtractor'

/** Extract memories from completed turns (every 5 turns) */
export const memoryExtractionHook: HookConfig = {
  id: 'builtin:memory-extraction',
  event: 'Stop',
  type: 'callback',
  priority: 50,
  enabled: true,
  timeoutMs: 15_000,
}

/** Suggest helpful next prompts based on conversation context */
export const promptSuggestionHook: HookConfig = {
  id: 'builtin:prompt-suggestion',
  event: 'Stop',
  type: 'prompt',
  priority: 60,
  enabled: true,
  prompt: `Review the last assistant response and suggest 1-2 natural follow-up prompts the user might want to ask. Keep suggestions concise and action-oriented. Return as JSON: [{ "suggestion": "..." }]`,
  timeoutMs: 10_000,
}

/** Manual trigger for memory extraction (called by hookPipeline via callback type) */
export async function onMemoryExtraction(ctx: import('../HookTypes').HookContext): Promise<import('../HookTypes').HookResult> {
  // Throttle: only extract every 5 turns
  if (ctx.turnCount % 5 !== 0) return {}

  try {
    await extractMemories(ctx.messages, ctx.task.goal, ctx.task.sessionId, ctx.task.projectId)
  } catch { /* best effort */ }
  return {}
}
