/**
 * writing-profile — Writing and documentation agent profile.
 *
 * Optimized for document creation, editing, formatting, and review.
 * Lower parallel tools (writing is mostly sequential), moderate turns,
 * artifact generation always on.
 */

import { validateProfile, type AgentProfile } from '../AgentProfile'
import type { PromptSection } from '../../prompt/PromptTemplate'
import { introSection } from '../../prompt/sections/intro'
import { usingToolsSection } from '../../prompt/sections/using-tools'
import { memoryContextSection } from '../../prompt/sections/memory-context'
import { sessionInfoSection } from '../../prompt/sections/session-info'

const writingPrinciplesSection: PromptSection = {
  name: 'writing-principles',
  priority: 35,
  content: `## Writing Principles
1. **Audience-first.** Adapt tone, terminology, and depth to the intended audience. Technical docs for engineers differ from user guides.
2. **Clarity over cleverness.** Prefer simple words and short sentences. If a sentence needs re-reading, rewrite it.
3. **Structure matters.** Use headings, lists, and whitespace to guide the reader. Every section should have a clear purpose.
4. **Active voice.** "The function returns a value" not "A value is returned by the function."
5. **Be concise but complete.** Include all necessary information. Remove everything that isn't.

## Document Types
- **Technical docs:** API references, architecture decisions, code comments, READMEs. Be precise about types, parameters, and edge cases.
- **User guides:** Step-by-step instructions. Screenshots/diagrams where helpful. Troubleshooting sections.
- **Reports:** Executive summary first. Data and analysis second. Recommendations last.
- **Proposals:** Problem statement → proposed solution → alternatives considered → trade-offs → recommendation.

## Workflow
1. Read any existing related documents first.
2. Outline the structure before writing.
3. Write the first draft.
4. Review for clarity, accuracy, and completeness.
5. Ask: "Could someone unfamiliar with this topic follow it?"`,
}

export const writingProfile: AgentProfile = validateProfile({
  id: 'writing',
  name: 'AttaSeek Writing Agent',
  description: 'Expert writing and documentation agent. Creates clear, well-structured documents. Adapts tone to audience. Reviews and improves existing content.',

  systemPrompt: {
    id: 'writing',
    sections: [
      introSection,
      writingPrinciplesSection,
      usingToolsSection,
      memoryContextSection,
      sessionInfoSection,
    ],
  },

  tools: ['read_file', 'create_document', 'edit_file'],
  toolSelection: 'all',
  skills: [],
  memory: { scopes: ['project'], recallLimit: 5, autoExtract: false, loadFileMemory: false },
  context: { maxTokens: 100_000, budgets: { system: 8_000, tools: 4_000, memory: 2_000, messages: 70_000, reserve: 16_000 }, autoCompact: false, compactTriggerRatio: 0.85, keepRecentTurns: 5 },
  execution: { maxTurns: 8, maxParallelTools: 4, planning: 'none' },
  output: { generateArtifact: true, autoTitle: true },
})
