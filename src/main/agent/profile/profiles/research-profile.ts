/**
 * research-profile — Deep research agent profile.
 *
 * Optimized for multi-source investigation: web search, fact verification,
 * source citation, synthesis into structured reports. Higher token budget
 * and more turns than coding (research needs broader context).
 */

import { validateProfile, type AgentProfile } from '../AgentProfile'
import type { PromptSection } from '../../prompt/PromptTemplate'
import { introSection } from '../../prompt/sections/intro'
import { usingToolsSection } from '../../prompt/sections/using-tools'
import { memoryContextSection } from '../../prompt/sections/memory-context'
import { sessionInfoSection } from '../../prompt/sections/session-info'

const researchMethodSection: PromptSection = {
  name: 'research-method',
  priority: 35,
  content: `## Research Method
1. **Multi-source.** Cross-reference claims across at least 2-3 independent sources before presenting as fact.
2. **Verify.** Adversarially check claims — try to find counter-evidence, not just confirmation.
3. **Cite.** Every factual claim must be traceable to a source. Use inline citations.
4. **Acknowledge uncertainty.** Distinguish between verified facts, expert consensus, competing views, and speculation.
5. **Synthesize, don't list.** Produce structured analysis, not just a list of findings. Connect the dots.

## Output Format
- Start with an executive summary (3-5 sentences).
- Organize findings by theme or argument, not by source.
- End with: key conclusions, open questions, and recommended next steps.`,
}

export const researchProfile: AgentProfile = validateProfile({
  id: 'research',
  name: 'AttaSeek Research Agent',
  description: 'Expert research agent. Conducts multi-source deep research, verifies claims adversarially, and synthesizes findings into structured reports with citations.',

  systemPrompt: {
    id: 'research',
    sections: [
      introSection,
      researchMethodSection,
      usingToolsSection,
      memoryContextSection,
      sessionInfoSection,
    ],
  },

  tools: ['read_file', 'search_code', 'web_search', 'web_fetch', 'create_document'],
  toolSelection: 'all',
  skills: ['deep-research'],
  memory: { scopes: ['project', 'user'], recallLimit: 20, autoExtract: true, loadFileMemory: true },
  context: { maxTokens: 150_000, budgets: { system: 12_000, tools: 8_000, memory: 8_000, messages: 100_000, reserve: 22_000 }, autoCompact: true, compactTriggerRatio: 0.80, keepRecentTurns: 5 },
  execution: { maxTurns: 30, maxParallelTools: 16, planning: 'inline' },
  output: { generateArtifact: true, autoTitle: true },
})
