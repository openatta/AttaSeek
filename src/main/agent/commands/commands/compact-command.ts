/**
 * /compact command — trigger manual context compaction.
 *
 * Usage:
 *   /compact         → compact the conversation immediately
 *
 * Inserts a compact boundary marker into the message history so the
 * next query loop iteration applies compaction before the LLM call.
 */

import type { SlashCommand } from '../CommandRegistry'

export const compactCommand: SlashCommand = {
  name: 'compact',
  description: 'Manually trigger context compaction to reduce token usage',

  execute(_args: string, ctx) {
    // Insert a compact boundary marker — the query loop's compaction
    // pipeline will pick this up on the next iteration.
    const compactMarkers = [
      {
        role: 'user' as const,
        content: '[Manual compact requested by user]',
      },
    ]

    return {
      messages: [
        ...ctx.messages,
        ...compactMarkers,
      ],
      shouldQuery: true,
      resultText: 'Context compaction triggered. The conversation has been summarized.',
    }
  },
}
