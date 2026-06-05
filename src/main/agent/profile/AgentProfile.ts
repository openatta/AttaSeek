/**
 * AgentProfile — declarative agent scenario configuration.
 *
 * One profile per domain (coding, research, writing, …).
 * The engine reads the profile but contains zero domain logic —
 * all domain-specific behavior is defined here.
 */

import type { PromptTemplate } from '../prompt/PromptTemplate'
import type { MemoryScope } from '../../../shared/types/Memory'

export interface AgentProfile {
  id: string
  name: string
  description: string

  /** System prompt template — sections assembled by PromptTemplate.render() */
  systemPrompt: PromptTemplate

  // ── Tools ──
  tools: string[]
  disallowedTools?: string[]
  toolSelection: 'all' | 'topk' | 'none'

  // ── Skills ──
  skills: string[]

  // ── Memory ──
  memory: {
    scopes: MemoryScope[]
    recallLimit: number
    autoExtract: boolean
    loadFileMemory: boolean
  }

  // ── Context management ──
  context: {
    maxTokens: number
    budgets: TokenBudgets
    autoCompact: boolean
    compactTriggerRatio: number  // default 0.85
    keepRecentTurns: number      // recent turns kept after compaction
  }

  // ── Execution strategy ──
  execution: {
    maxTurns: number
    maxParallelTools: number
    planning: 'none' | 'inline'
  }

  // ── Output ──
  output: {
    generateArtifact: boolean
    autoTitle: boolean
  }
}

export interface TokenBudgets {
  system: number     // system prompt
  tools: number      // tool definitions
  memory: number     // memory context
  messages: number   // message history
  reserve: number    // output reservation
}

/** Validate a profile and fill in defaults for missing fields */
export function validateProfile(p: Partial<AgentProfile> & { id: string; name: string; systemPrompt: PromptTemplate }): AgentProfile {
  return {
    id: p.id,
    name: p.name,
    description: p.description || '',
    systemPrompt: p.systemPrompt,
    tools: p.tools || [],
    toolSelection: p.toolSelection || 'topk',
    skills: p.skills || [],
    memory: {
      scopes: p.memory?.scopes || ['project'],
      recallLimit: p.memory?.recallLimit ?? 10,
      autoExtract: p.memory?.autoExtract ?? false,
      loadFileMemory: p.memory?.loadFileMemory ?? false,
    },
    context: {
      maxTokens: p.context?.maxTokens ?? 100_000,
      budgets: {
        system: p.context?.budgets?.system ?? 8_000,
        tools: p.context?.budgets?.tools ?? 12_000,
        memory: p.context?.budgets?.memory ?? 4_000,
        messages: p.context?.budgets?.messages ?? 60_000,
        reserve: p.context?.budgets?.reserve || 16_000,
      },
      autoCompact: p.context?.autoCompact ?? true,
      compactTriggerRatio: p.context?.compactTriggerRatio ?? 0.85,
      keepRecentTurns: p.context?.keepRecentTurns ?? 5,
    },
    execution: {
      maxTurns: p.execution?.maxTurns ?? 10,
      maxParallelTools: p.execution?.maxParallelTools ?? 16,
      planning: p.execution?.planning || 'none',
    },
    output: {
      generateArtifact: p.output?.generateArtifact ?? true,
      autoTitle: p.output?.autoTitle ?? true,
    },
  }
}
