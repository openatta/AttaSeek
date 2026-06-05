/** Minimal test profile for scenario tests — fast execution, no LLM cost */
import { validateProfile, type AgentProfile } from '../../../../src/main/agent/profile/AgentProfile'

export const testProfile: AgentProfile = validateProfile({
  id: 'test',
  name: 'Test Agent',
  systemPrompt: {
    id: 'test',
    sections: [{ name: 'identity', priority: 10, content: 'You are a test agent.' }],
  },
  execution: { maxTurns: 3, maxParallelTools: 2 },
  memory: { autoExtract: false },
  context: { autoCompact: false, maxTokens: 10_000 },
  output: { generateArtifact: false, autoTitle: false },
})
