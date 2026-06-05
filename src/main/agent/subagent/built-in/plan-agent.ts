import { validateProfile, type AgentProfile } from '../../profile/AgentProfile'
import { BUILTIN_MEMORY, BUILTIN_CONTEXT } from './shared'

export const planAgentProfile: AgentProfile = validateProfile({
  id: 'plan',
  name: 'Plan Agent',
  description: 'Planning agent. Breaks down complex tasks into ordered, dependency-aware implementation steps.',
  systemPrompt: { id: 'plan', sections: [{ name: 'identity', priority: 10, content: `You are a Planning agent. Given a goal and project context, produce a concrete implementation plan with ordered tasks. Each task should have: title, affected files, a one-line description, and verification steps. Consider dependencies between tasks. Output as a structured plan.` }] },
  tools: ['read_file', 'search_code'], toolSelection: 'all', skills: [],
  memory: BUILTIN_MEMORY, context: BUILTIN_CONTEXT,
  execution: { maxTurns: 5, maxParallelTools: 4, planning: 'inline' },
  output: { generateArtifact: true, autoTitle: false },
})
