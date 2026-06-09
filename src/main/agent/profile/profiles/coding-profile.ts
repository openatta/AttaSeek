/**
 * coding-profile — Programming agent profile anchored to Claude Code.
 *
 * The system prompt sections mirror Claude Code's coding behavior
 * (src/constants/prompts.ts). Section structure and content are kept
 * strictly aligned with Claude Code's getSystemPrompt() output.
 *
 * Architecture: the profile system (AgentProfile) is an AttaSeek
 * differentiator. Each profile is a self-contained .ts file defining:
 *   - systemPrompt: PromptTemplate with ordered sections
 *   - tools: allowed tool IDs
 *   - memory: memory configuration
 *   - context: token budgets + compaction parameters
 *   - execution: maxTurns, parallel tools, planning mode
 *   - output: artifact generation settings
 *
 * See _TEMPLATE.ts for creating new profiles.
 */

import { validateProfile, type AgentProfile } from '../AgentProfile'
import { introSection } from '../../prompt/sections/intro'
import { systemSection } from '../../prompt/sections/system'
import { doingTasksSection } from '../../prompt/sections/doing-tasks'
import { actionsSection } from '../../prompt/sections/actions'
import { usingToolsSection } from '../../prompt/sections/using-tools'
import { toneAndStyleSection } from '../../prompt/sections/tone-and-style'
import { outputEfficiencySection } from '../../prompt/sections/output-efficiency'
import { sessionGuidanceSection } from '../../prompt/sections/session-guidance'
import { memoryContextSection } from '../../prompt/sections/memory-context'
import { envInfoSection } from '../../prompt/sections/env-info'
import { languageSection } from '../../prompt/sections/language'
import { mcpInstructionsSection } from '../../prompt/sections/mcp-instructions'
import { scratchpadSection } from '../../prompt/sections/scratchpad'
import { summarizeResultsSection } from '../../prompt/sections/summarize-results'

// ── Profile ──

export const codingProfile: AgentProfile = validateProfile({
  id: 'coding',
  name: 'AttaSeek Code Agent',
  description:
    'Expert programming agent. Reads, writes, and refactors code across all languages. Follows existing patterns, uses TDD, and verifies changes.',

  systemPrompt: {
    id: 'coding',
    sections: [
      // ── Static sections (cacheable, priority 10-70) ──
      introSection,           // 10: identity + security boundary + URL rules
      systemSection,           // 20: harness description
      doingTasksSection,       // 30: task execution philosophy
      actionsSection,          // 40: action risk assessment
      usingToolsSection,       // 50: tool usage guidance
      toneAndStyleSection,     // 60: formatting conventions
      outputEfficiencySection, // 70: output conciseness

      // ── Dynamic sections (session/user specific, priority 80-160) ──
      sessionGuidanceSection,  // 80: AskUserQuestion, shell, Agent, Skill guidance
      memoryContextSection,    // 90: CLAUDE.md, memories, session memory, compact summary
      envInfoSection,          // 100: working dir, git, platform, shell, model info
      languageSection,         // 110: language preference (conditional)
      mcpInstructionsSection,  // 130: MCP server instructions (conditional)
      scratchpadSection,       // 140: scratchpad directory (conditional)
      summarizeResultsSection, // 160: post-compaction content save reminder
    ],
  },

  tools: [
    'read_file', 'write_file', 'edit_file',
    'search_code', 'glob', 'grep',
    'bash', 'git_commit', 'git_diff', 'git_log',
    'lsp_diagnostic', 'lsp_definition', 'lsp_references',
    'task_create', 'task_update', 'task_list',
    'spawn_agent', 'send_message',
    'skill',
    'ask_user_question',
    'web_search', 'web_fetch',
  ],
  toolSelection: 'topk',

  skills: ['code-review'],

  memory: {
    scopes: ['project', 'user'],
    recallLimit: 10,
    autoExtract: true,
    loadFileMemory: true,
  },

  context: {
    maxTokens: 100_000,
    budgets: {
      system: 8_000,
      tools: 12_000,
      memory: 4_000,
      messages: 60_000,
      reserve: 16_000,
    },
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
