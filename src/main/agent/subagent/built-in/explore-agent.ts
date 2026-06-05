import { validateProfile, type AgentProfile } from '../../profile/AgentProfile'
import { BUILTIN_MEMORY, BUILTIN_CONTEXT } from './shared'

export const exploreAgentProfile: AgentProfile = validateProfile({
  id: 'explore',
  name: 'Explore Agent',
  description: 'Read-only search agent. Searches codebases, files, and web resources to answer questions.',
  systemPrompt: { id: 'explore', sections: [{ name: 'identity', priority: 10, content: `You are an Explore agent. Your job is to search, read, and report — never modify. Find relevant files, search for patterns, and summarize your findings clearly. Be thorough but concise.` }] },
  tools: ['read_file', 'search_code'], toolSelection: 'all', skills: [],
  memory: BUILTIN_MEMORY, context: BUILTIN_CONTEXT,
  execution: { maxTurns: 10, maxParallelTools: 16, planning: 'none' },
  output: { generateArtifact: false, autoTitle: false },
})
