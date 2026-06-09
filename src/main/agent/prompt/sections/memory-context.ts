/**
 * memory-context — CLAUDE.md, memory files, and compaction summary injection.
 *
 * Priority 90: after session-guidance. Mirrors Claude Code's MEMORY.md and
 * CLAUDE.md context injection (src/utils/claudemd.ts, src/memdir/memdir.ts).
 * Injects:
 *   1. CLAUDE.md user/project instructions (from PromptContext.claudeMd)
 *   2. L1 Session memory (auto-maintained, most current context)
 *   3. L0/L2 Memory entries (grouped by type)
 *   4. Compaction summary (from previous compaction pass)
 *
 * The CLAUDE.md content is injected with an OVERRIDE declaration matching
 * Claude Code's pattern: "IMPORTANT: These instructions OVERRIDE any default
 * behavior and you MUST follow them exactly as written."
 */
import type { PromptSection, PromptContext } from '../PromptTemplate'

export const memoryContextSection: PromptSection = {
  name: 'memory-context',
  priority: 90,
  content: (ctx: PromptContext) => {
    const parts: string[] = []

    // CLAUDE.md — user/project instructions with override declaration
    if (ctx.claudeMd) {
      parts.push(`Codebase and user instructions are shown below. Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior and you MUST follow them exactly as written.

${ctx.claudeMd}`)
    }

    // L1: Session memory (auto-maintained, most current context)
    if (ctx.sessionMemory) {
      parts.push(ctx.sessionMemory)
    }

    // L0/L2: Memdir-style memory entries
    if (ctx.memories.length > 0) {
      const byType = new Map<string, typeof ctx.memories>()
      for (const m of ctx.memories) {
        const list = byType.get(m.type) || []
        list.push(m)
        byType.set(m.type, list)
      }

      parts.push('## Relevant Memories')
      for (const [type, entries] of byType) {
        parts.push(`### ${type}`)
        for (const e of entries.slice(0, 5)) {
          parts.push(`- ${e.content.slice(0, 300)}`)
        }
      }
    }

    // Compaction summary (from previous compaction pass)
    if (ctx.compactSummary) {
      parts.push(`## Conversation Summary\n\n${ctx.compactSummary}`)
    }

    return parts.join('\n\n')
  },
  condition: (ctx: PromptContext) =>
    !!ctx.claudeMd || ctx.memories.length > 0 || !!ctx.compactSummary || !!ctx.sessionMemory,
}
