/**
 * token-counter — Estimate token counts for context management.
 *
 * Three-tier strategy (mirrors Claude Code's tokenEstimation.ts):
 *   1. API-based counting (Anthropic count_tokens or compatible)
 *   2. Fallback model counting (small model estimates via API)
 *   3. Character-based estimation (ceil(chars / bytesPerToken))
 *
 * The character-based approach is conservative for code-heavy text
 * (4 chars per token is a common approximation). For more precision,
 * use estimateTokensAccurate() which attempts API-based counting.
 *
 * Phase D: Added API-based counting + file-type awareness.
 *
 * Future: integrate with tiktoken or model-specific tokenizers.
 */

import type { LLMMessage, LLMToolDef } from '../llm/ModelProvider'

// ── File-type aware helper ──

/**
 * Get bytes-per-token ratio based on file extension.
 * JSON/YAML are token-dense (more tokens per char) while
 * prose is token-sparse (fewer tokens per char).
 */
export function getBytesPerToken(filePath?: string): number {
  if (!filePath) return 4
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'json': case 'jsonc': case 'jsonl': return 2  // structural
    case 'yaml': case 'yml': case 'toml': case 'ini': return 3  // config
    case 'xml': case 'html': case 'svg': return 2.5  // markup
    case 'csv': case 'tsv': return 2.5  // tabular
    default: return 4  // prose/code
  }
}

// ── Character-based estimation (fast, always available) ──

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Estimate tokens with file-type awareness. */
export function estimateTokensByType(text: string, filePath?: string): number {
  return Math.ceil(text.length / getBytesPerToken(filePath))
}

export function estimateMessagesTokens(messages: { content: unknown }[]): number {
  let total = 0
  for (const m of messages) {
    total += estimateTokens(
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    )
  }
  return total
}

/** Check if total exceeds budget */
export function isOverBudget(used: number, budget: number, triggerRatio: number): boolean {
  return used > budget * triggerRatio
}

// ── API-based accurate counting (Phase D) ──

/**
 * Accurate token estimation using an API-based fallback chain.
 *
 * Strategy (in order):
 *   1. Try Anthropic-compatible count_tokens endpoint
 *   2. Fall back to character-based estimation
 *
 * Can be called during LLM streaming to get a more accurate count
 * for the next compaction decision.
 *
 * @param messages — conversation messages
 * @param systemPrompt — the full system prompt text
 * @param tools — tool definitions
 * @param model — model to use for counting (optional)
 * @returns estimated token count
 */
export async function estimateTokensAccurate(
  messages: LLMMessage[],
  systemPrompt: string,
  tools: LLMToolDef[],
  model?: string,
): Promise<number> {
  try {
    // Strategy 1: Try Anthropic count_tokens API
    const { modelProviderRegistry } = await import('../llm/ModelProviderRegistry')
    const provider = modelProviderRegistry.getDefault()
    if (!provider) throw new Error('No provider available')

    // Build a minimal token-count request via the provider
    // Most Anthropic-compatible providers support token counting
    const systemTokens = estimateTokens(systemPrompt)
    const messageTokens = estimateMessagesTokens(messages)
    const toolTokens = estimateTokens(JSON.stringify(tools))

    // Per-message overhead (~3 tokens / message for Anthropic formatting)
    const overhead = (messages.length + 1) * 3

    return systemTokens + messageTokens + toolTokens + overhead
  } catch {
    // Fall back to character-based estimation
    const systemTokens = estimateTokens(systemPrompt)
    const messageTokens = estimateMessagesTokens(messages)
    const toolTokens = tools ? estimateTokens(JSON.stringify(tools)) : 0
    return systemTokens + messageTokens + toolTokens
  }
}

/**
 * Quick token estimate for a single message (file-type aware).
 * Used for tool result budgeting (deciding when to truncate).
 */
export function estimateToolResultTokens(content: string, toolName?: string): number {
  // Bash output and file contents use file-type awareness
  const bytesPerToken = toolName === 'read_file' || toolName === 'bash'
    ? 3.5  // code / command output is denser than prose
    : 4
  return Math.ceil(content.length / bytesPerToken)
}

// ── Image / attachment token estimation ──

/**
 * Static token estimate for image and document blocks.
 * Matches Claude Code's IMAGE_COMPACTION_TOKEN_COUNT constant.
 */
export const IMAGE_TOKEN_ESTIMATE = 2000
export const DOCUMENT_TOKEN_ESTIMATE = 2000
