/**
 * /model command — switch the active LLM model.
 *
 * Usage:
 *   /model opus       → switch to claude-opus-4-8
 *   /model sonnet     → switch to claude-sonnet-4-6
 *   /model haiku      → switch to claude-haiku-4-5
 *   /model list       → show available models
 */

import type { SlashCommand } from '../CommandRegistry'

const MODEL_ALIASES: Record<string, string> = {
  'opus': 'claude-opus-4-8',
  'opus4': 'claude-opus-4-8',
  'sonnet': 'claude-sonnet-4-6',
  'sonnet4': 'claude-sonnet-4-6',
  'haiku': 'claude-haiku-4-5',
  'haiku4': 'claude-haiku-4-5',
  'gpt4o': 'gpt-4o',
  'gpt4': 'gpt-4o',
}

export const modelCommand: SlashCommand = {
  name: 'model',
  description: 'Switch the active LLM model (opus, sonnet, haiku, gpt4o)',
  aliases: ['m'],

  execute(args: string) {
    const trimmed = args.trim().toLowerCase()

    // List available models
    if (!trimmed || trimmed === 'list') {
      const lines = ['**Available models:**', '']
      for (const [alias, fullName] of Object.entries(MODEL_ALIASES)) {
        lines.push(`- \`${alias}\` → ${fullName}`)
      }
      return {
        messages: [{ role: 'user' as const, content: lines.join('\n') }],
        shouldQuery: false,
        resultText: lines.join('\n'),
      }
    }

    const resolved = MODEL_ALIASES[trimmed] || trimmed
    const isKnown = Object.values(MODEL_ALIASES).includes(resolved) ||
      Object.keys(MODEL_ALIASES).includes(trimmed)

    const infoMsg = isKnown
      ? `Switched model to **${resolved}**.`
      : `Using model **${resolved}** (unrecognized alias — passed through as-is).`

    return {
      messages: [{ role: 'user' as const, content: `[System: ${infoMsg}]` }],
      shouldQuery: true,
      modelOverride: resolved,
      resultText: infoMsg,
    }
  },
}
