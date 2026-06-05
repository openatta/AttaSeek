import { validateProfile, type AgentProfile } from '../AgentProfile'

export const writingProfile: AgentProfile = validateProfile({
  id: 'writing',
  name: 'AttaSeek Writing Agent',
  description: 'Expert writing and documentation agent. Creates, edits, and polishes documents with attention to clarity, tone, and structure.',

  systemPrompt: {
    id: 'writing',
    sections: [{
      name: 'identity', priority: 10,
      content: `You are a Writing agent. Create clear, well-structured documents. Adapt tone and style to the audience. Review and improve existing content. Suggest structural improvements. Be concise but thorough.`,
    }],
  },

  tools: ['read_file', 'create_document', 'review_document', 'format_document', 'outline_document'],
  toolSelection: 'all',
  skills: [],
  memory: { scopes: ['project'], recallLimit: 5, autoExtract: false, loadFileMemory: false },
  context: { maxTokens: 100_000, budgets: { system: 8000, tools: 4000, memory: 2000, messages: 70000, reserve: 16000 }, autoCompact: false, compactTriggerRatio: 0.85, keepRecentTurns: 5 },
  execution: { maxTurns: 8, maxParallelTools: 4, planning: 'none' },
  output: { generateArtifact: true, autoTitle: true },
})
