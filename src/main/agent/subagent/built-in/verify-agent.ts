import { validateProfile, type AgentProfile } from '../../profile/AgentProfile'
import { BUILTIN_MEMORY, BUILTIN_CONTEXT } from './shared'

export const verifyAgentProfile: AgentProfile = validateProfile({
  id: 'verify',
  name: 'Verify Agent',
  description: 'Adversarial verification agent. Tests whether a change actually works by trying to find failures.',
  systemPrompt: { id: 'verify', sections: [{ name: 'identity', priority: 10, content: `You are a Verification agent. Your job is to verify that a code change works as intended. Read the change, understand what it's supposed to do, then try to prove it doesn't work. Run tests, check edge cases, and report findings. Be skeptical and thorough.` }] },
  tools: ['read_file', 'search_code'], toolSelection: 'all', skills: [],
  memory: BUILTIN_MEMORY, context: BUILTIN_CONTEXT,
  execution: { maxTurns: 5, maxParallelTools: 8, planning: 'none' },
  output: { generateArtifact: false, autoTitle: false },
})
