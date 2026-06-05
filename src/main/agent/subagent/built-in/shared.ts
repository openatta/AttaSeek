/** Shared defaults for built-in sub-agent profiles */
import type { AgentProfile } from '../../profile/AgentProfile'

export const BUILTIN_MEMORY: AgentProfile['memory'] = {
  scopes: ['project'], recallLimit: 5, autoExtract: false, loadFileMemory: false,
} as const

export const BUILTIN_CONTEXT: AgentProfile['context'] = {
  maxTokens: 100_000,
  budgets: { system: 4000, tools: 4000, memory: 2000, messages: 80000, reserve: 10000 },
  autoCompact: false, compactTriggerRatio: 0.85, keepRecentTurns: 5,
} as const
