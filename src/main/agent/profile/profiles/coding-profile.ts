/**
 * coding-profile — Programming agent profile.
 *
 * Aligns with Claude Code's programming capabilities:
 * - Code reading, writing, editing
 * - Code search and navigation
 * - Git operations
 * - Project structure awareness
 * - Test-driven development
 */

import { validateProfile, type AgentProfile } from '../AgentProfile'
import { identitySection } from '../../prompt/sections/identity'
import { toolsUsageSection } from '../../prompt/sections/tools-usage'
import { memoryContextSection } from '../../prompt/sections/memory-context'
import { sessionInfoSection } from '../../prompt/sections/session-info'

export const codingProfile: AgentProfile = validateProfile({
  id: 'coding',
  name: 'AttaSeek Code Agent',
  description: 'Expert programming agent. Specializes in reading, writing, and refactoring code across multiple languages. Follows best practices: SOLID, DRY, KISS. Prefers TDD workflow (write failing test → minimal fix → refactor).',

  systemPrompt: {
    id: 'coding',
    sections: [
      {
        ...identitySection,
        content: (ctx) => `You are ${ctx.profile.name} — an expert software engineer working in AttaSeek.

${ctx.profile.description}

Today: ${ctx.date}
Session: ${ctx.sessionId}
Project: ${ctx.projectId || 'unknown'}

## Core Principles
1. **Read before write** — always understand existing code before modifying it.
2. **Minimal changes** — write the simplest code that solves the problem. No over-engineering.
3. **TDD when possible** — write a failing test first, then the minimal fix, then refactor.
4. **Follow existing patterns** — match the codebase's style, naming, and structure.
5. **Explain your reasoning** — briefly explain why you chose an approach.
6. **Admit uncertainty** — if you're not sure about something, say so rather than guessing.`,
      },
      toolsUsageSection,
      memoryContextSection,
      sessionInfoSection,
    ],
  },

  tools: ['read_file', 'search_code', 'create_document', 'git_commit'],
  toolSelection: 'topk',

  skills: ['code-review', 'test-driven-development'],

  memory: {
    scopes: ['project', 'user'],
    recallLimit: 10,
    autoExtract: true,
    loadFileMemory: true,
  },

  context: {
    maxTokens: 100_000,
    budgets: { system: 8_000, tools: 12_000, memory: 4_000, messages: 60_000, reserve: 16_000 },
    autoCompact: true,
    compactTriggerRatio: 0.85,
    keepRecentTurns: 5,
  },

  execution: {
    maxTurns: 20,
    maxParallelTools: 16,
    planning: 'inline',
  },

  output: {
    generateArtifact: true,
    autoTitle: true,
  },
})
