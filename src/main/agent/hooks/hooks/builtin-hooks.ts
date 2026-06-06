/**
 * Built-in post-sampling hooks — confidence, coaching, brief, memory.
 */

import type { PostSamplingHook } from '../HookManager'
import { extractMemories } from '../../memory/MemoryExtractor'

// ── Confidence Hook ──
export const confidenceHook: PostSamplingHook = {
  name: 'confidence',
  priority: 10,
  trigger: 'every',
  async execute(ctx) {
    const text = ctx.lastAssistantContent
    const hedges = ['I think', 'might', 'could be', 'possibly', 'maybe', 'not sure', 'probably']
    const hedgeCount = hedges.filter(h => text.toLowerCase().includes(h.toLowerCase())).length
    const words = text.split(/\s+/).length
    const ratio = words > 0 ? hedgeCount / Math.max(1, words / 100) : 0

    if (ratio > 2) {
      return { messages: [`[Confidence: low — ${hedgeCount} hedging phrases detected. Consider being more decisive or asking clarifying questions.]`] }
    }
    return {}
  },
}

// ── Coaching Hook ──
export const coachingHook: PostSamplingHook = {
  name: 'coaching',
  priority: 20,
  trigger: 'interval',
  interval: 3,
  async execute(_ctx) {
    return {
      messages: ['[Coaching tip: When making code changes, always explain WHY, not just WHAT. Mention tradeoffs considered.]'],
    }
  },
}

// ── Brief Hook ──
export const briefHook: PostSamplingHook = {
  name: 'brief',
  priority: 30,
  trigger: 'every',
  async execute(_ctx) {
    return {
      messages: ['[Brief: You can continue with the next step, or the user may provide additional instructions.]'],
    }
  },
}

// ── Memory Hook (delegates to MemoryExtractor) ──
export const memoryHook: PostSamplingHook = {
  name: 'memory',
  priority: 40,
  trigger: 'interval',
  interval: 5,
  async execute(ctx) {
    try {
      await extractMemories(ctx.messages, ctx.task.goal, ctx.task.sessionId, ctx.task.projectId)
    } catch { /* best effort */ }
    return {}
  },
}
