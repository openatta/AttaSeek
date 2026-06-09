/**
 * Profile factories — centralized creation of runtime AgentProfile instances.
 *
 * Consolidates profile factories that were previously scattered across
 * SubAgentManager, SwarmManager, and agent-tool-impl.
 */

import { validateProfile, type AgentProfile } from './AgentProfile'

// ── Continuation profile ──

/**
 * Lightweight AgentProfile for worker continuation.
 * Used by SubAgentManager.continueWorker() and SwarmManager.sendMessage().
 */
export function createContinuationProfile(): AgentProfile {
  return validateProfile({
    id: 'continuation',
    name: 'Continuation',
    description: 'Continues a previously running worker agent.',
    systemPrompt: { id: 'continuation', sections: [] },
    tools: [],
    toolSelection: 'all',
    skills: [],
    memory: { scopes: [], recallLimit: 5, autoExtract: false, loadFileMemory: false },
    context: {
      maxTokens: 100_000,
      budgets: { system: 4000, tools: 4000, memory: 2000, messages: 80_000, reserve: 10_000 },
      autoCompact: false,
      compactTriggerRatio: 0.85,
      keepRecentTurns: 5,
    },
    execution: { maxTurns: 10, maxParallelTools: 4, planning: 'none' },
    output: { generateArtifact: false, autoTitle: false },
  })
}

// ── Swarm teammate profiles ──

/** Build a swarm teammate profile with default worker parameters. */
export function createSpawnProfile(name: string, goal: string): AgentProfile {
  return validateProfile({
    id: `swarm_${name}`,
    name: `Swarm: ${name}`,
    description: goal,
    systemPrompt: { id: 'swarm', sections: [] },
    tools: ['*'],
    toolSelection: 'all',
    skills: [],
    memory: { scopes: ['project'], recallLimit: 10, autoExtract: false, loadFileMemory: false },
  })
}

/** Build a lightweight reply profile for sendMessage continuations. */
export function createReplyProfile(name: string, message: string): AgentProfile {
  return validateProfile({
    id: 'swarm_reply',
    name: `Reply: ${name}`,
    description: message,
    systemPrompt: { id: 'swarm_reply', sections: [] },
    tools: ['*'],
    toolSelection: 'all',
    skills: [],
    memory: { scopes: ['project'], recallLimit: 5, autoExtract: false, loadFileMemory: false },
    context: {
      maxTokens: 50000,
      budgets: { system: 4000, tools: 8000, memory: 2000, messages: 30000, reserve: 6000 },
      autoCompact: false,
      compactTriggerRatio: 0.9,
      keepRecentTurns: 3,
    },
    execution: { maxTurns: 5, maxParallelTools: 4, planning: 'none' as const },
    output: { generateArtifact: false, autoTitle: false },
  })
}
