/**
 * ModelAliases — canonical model name resolution.
 *
 * Short aliases (sonnet, opus, haiku) resolve to full model IDs.
 * Provider-specific model config constants provide the canonical names.
 *
 * Inspired by Claude Code's utils/model/aliases.ts and model.ts.
 */

// ── Canonical model IDs (current as of 2026-06) ──

export const CLAUDE_SONNET = 'claude-sonnet-4-6'
export const CLAUDE_OPUS = 'claude-opus-4-8'
export const CLAUDE_HAIKU = 'claude-haiku-4-5-20251001'

// ── Alias map ──

const ALIASES: Record<string, string> = {
  // Anthropic family aliases
  sonnet: CLAUDE_SONNET,
  opus: CLAUDE_OPUS,
  haiku: CLAUDE_HAIKU,

  // Legacy aliases
  'claude-sonnet': CLAUDE_SONNET,
  'claude-opus': CLAUDE_OPUS,
  'claude-haiku': CLAUDE_HAIKU,

  // Common abbreviations
  'sonnet-4.6': CLAUDE_SONNET,
  'opus-4.8': CLAUDE_OPUS,
  'haiku-4.5': CLAUDE_HAIKU,

  // Claude Code compat
  'claude-sonnet-4': CLAUDE_SONNET,
  'claude-opus-4': CLAUDE_OPUS,
}

// ── Known model families for capability detection ──

const FAMILY_SONNET = /claude-sonnet/i
const FAMILY_OPUS = /claude-opus/i
const FAMILY_HAIKU = /claude-haiku/i
const FAMILY_CLAUDE = /^claude-/i

/** Resolve an alias or model name to its canonical form. Returns the input unchanged if no alias matches. */
export function resolveModelAlias(name: string): string {
  const lower = name.toLowerCase().trim()
  return ALIASES[lower] ?? name
}

/** Check if a model name refers to a Claude-family model */
export function isClaudeModel(name: string): boolean {
  return FAMILY_CLAUDE.test(resolveModelAlias(name))
}

/** Get the model family of a model name */
export function getModelFamily(name: string): 'sonnet' | 'opus' | 'haiku' | 'other' {
  const resolved = resolveModelAlias(name)
  if (FAMILY_OPUS.test(resolved)) return 'opus'
  if (FAMILY_SONNET.test(resolved)) return 'sonnet'
  if (FAMILY_HAIKU.test(resolved)) return 'haiku'
  return 'other'
}

/** List all known aliases (for UI display) */
export function listAliases(): Array<{ alias: string; canonical: string }> {
  return Object.entries(ALIASES).map(([alias, canonical]) => ({ alias, canonical }))
}
