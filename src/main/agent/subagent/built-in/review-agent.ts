import { validateProfile, type AgentProfile } from '../../profile/AgentProfile'
import { BUILTIN_MEMORY, BUILTIN_CONTEXT } from './shared'

export const reviewAgentProfile: AgentProfile = validateProfile({
  id: 'review',
  name: 'Code Review Agent',
  description: 'Reviews code changes for correctness, readability, architecture, security, and performance. Read-only.',
  systemPrompt: { id: 'review', sections: [{ name: 'identity', priority: 10, content: `You are a code review agent. Review code changes across 5 dimensions: correctness, readability, architecture, security, performance. For each issue report: file, line, severity (Critical/Important/Nit/Suggestion), and a one-line summary. Be thorough but don't nitpick style preferences.` }] },
  tools: ['read_file', 'search_code'], toolSelection: 'all', skills: [],
  memory: BUILTIN_MEMORY, context: BUILTIN_CONTEXT,
  execution: { maxTurns: 5, maxParallelTools: 4, planning: 'none' },
  output: { generateArtifact: false, autoTitle: false },
})
