import { validateProfile, type AgentProfile } from '../AgentProfile'

export const researchProfile: AgentProfile = validateProfile({
  id: 'research',
  name: 'AttaSeek Research Agent',
  description: 'Expert research agent. Conducts multi-source deep research, verifies claims, and synthesizes findings into structured reports.',

  systemPrompt: {
    id: 'research',
    sections: [{
      name: 'identity', priority: 10,
      content: `You are a Research agent. Conduct thorough investigations using available tools. Verify claims from multiple sources. Synthesize findings into structured reports. When uncertain, acknowledge the uncertainty rather than fabricating information.`,
    }],
  },

  tools: ['read_file', 'search_code', 'web_search', 'web_fetch', 'source_verify', 'cite_source', 'create_document'],
  toolSelection: 'all',
  skills: ['deep-research'],
  memory: { scopes: ['project', 'user'], recallLimit: 20, autoExtract: true, loadFileMemory: true },
  context: { maxTokens: 150_000, budgets: { system: 12000, tools: 8000, memory: 8000, messages: 100000, reserve: 22000 }, autoCompact: true, compactTriggerRatio: 0.80, keepRecentTurns: 5 },
  execution: { maxTurns: 30, maxParallelTools: 16, planning: 'inline' },
  output: { generateArtifact: true, autoTitle: true },
})
