/**
 * _TEMPLATE.ts — Template for creating new agent profiles.
 *
 * Copy this file to create a new scenario profile (e.g., data-science-profile.ts,
 * devops-profile.ts, teaching-profile.ts). Each profile is a self-contained
 * .ts file that defines the complete agent configuration for one scenario.
 *
 * ## Quick Start
 *
 * 1. Copy this file:  cp _TEMPLATE.ts my-new-profile.ts
 * 2. Pick an `id` (matching filename) and a user-facing `name`
 * 3. Choose which prompt sections to include (import from ../../prompt/sections/)
 * 4. Define the tool allowlist, memory config, context budgets, execution params
 * 5. Register in the profile loader (if using dynamic profile selection)
 *
 * ## Prompt Section Reference
 *
 * Available sections (import from ../../prompt/sections/):
 *
 *   Static (priority 10-70, cacheable):
 *     introSection             — Identity + security boundary + URL rules
 *     systemSection            — Harness description
 *     doingTasksSection        — Task execution philosophy (coding-specific)
 *     actionsSection           — Action risk assessment
 *     usingToolsSection        — Tool usage guidance (dynamic, needs ctx.tools)
 *     toneAndStyleSection      — Formatting conventions
 *     outputEfficiencySection  — Output conciseness
 *
 *   Dynamic (priority 80-160, session-specific):
 *     sessionGuidanceSection   — AskUserQuestion, shell, Agent/Skill guidance
 *     memoryContextSection     — CLAUDE.md, memories, session memory, compact
 *     envInfoSection           — Working dir, git, platform, shell, model info
 *     languageSection          — Language preference (conditional)
 *     mcpInstructionsSection   — MCP server instructions (conditional)
 *     scratchpadSection        — Scratchpad directory (conditional)
 *     summarizeResultsSection  — Post-compaction content save reminder
 *
 * ## Creating Custom Sections
 *
 * For profile-specific behavior that doesn't fit shared sections, create custom
 * sections inline or as separate files:
 *
 * ```ts
 * const myCustomSection: PromptSection = {
 *   name: 'my-custom',
 *   priority: 85,  // slot between session-guidance (80) and memory-context (90)
 *   content: (ctx: PromptContext) => `## My Custom Guidance\n...`,
 *   condition: (ctx: PromptContext) => ctx.tools.length > 0,
 * }
 * ```
 *
 * ## Section Priority Layout
 *
 *   10  intro              Identity + security boundary
 *   20  system             Harness description
 *   30  doing-tasks        Task execution philosophy
 *   40  actions            Action risk assessment
 *   50  using-tools        Tool usage guidance
 *   60  tone-and-style     Formatting conventions
 *   70  output-efficiency  Output conciseness
 *   --- cache boundary ---
 *   80  session-guidance   Tool-specific session guidance
 *   90  memory-context     CLAUDE.md + memories + compact summary
 *  100  env-info           Environment info (dir, git, platform, model)
 *  110  language           Language preference (conditional)
 *  120  output-style       Output style (conditional)
 *  130  mcp-instructions   MCP server instructions (conditional)
 *  140  scratchpad         Scratchpad directory (conditional)
 *  160  summarize-results  Post-compaction reminder
 *
 * ## Tool IDs
 *
 * Built-in tool IDs available for the tools allowlist:
 *   read_file, write_file, edit_file, glob, grep, search_code
 *   bash / execute_command
 *   git_commit, git_diff, git_log
 *   lsp_diagnostic, lsp_definition, lsp_references
 *   task_create, task_update, task_list
 *   spawn_agent, send_message
 *   skill
 *   ask_user_question
 *   web_search, web_fetch
 *   create_document
 *   cron_create, cron_delete, cron_list
 *   monitor_start, monitor_stop
 *   plan_create, plan_use
 *   structured_output
 *   workflow
 *   push_notification
 */

import { validateProfile, type AgentProfile } from '../AgentProfile'
import type { PromptSection, PromptContext } from '../../prompt/PromptTemplate'
import { introSection } from '../../prompt/sections/intro'
import { systemSection } from '../../prompt/sections/system'
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

// ── Custom sections (profile-specific) ──
// Replace these with your profile's unique behavior guidance.
// For coding-specific sections, see doing-tasks.ts as a reference.

/**
 * Custom task execution section for this profile.
 * Replace the content with your profile's behavioral principles.
 */
const customDoingTasksSection: PromptSection = {
  name: 'doing-tasks',
  priority: 30,
  content: `# Doing tasks

 - Describe your task philosophy here. What principles should guide the agent?
 - Be specific about what constitutes good work in this domain.
 - Include verification and quality standards.
 - Cover error handling and escalation patterns.`,
}

/**
 * Custom identity section (optional).
 * Override the default intro section if this profile needs a different
 * role statement. Otherwise, keep introSection which uses ctx.profile.name.
 */
const customIdentitySection: PromptSection = {
  name: 'identity-override',
  priority: 10,
  content: (ctx: PromptContext) =>
    `You are ${ctx.profile.name}, ${ctx.profile.description}.

IMPORTANT: Assist with authorized security testing, defensive security, CTF challenges, and educational contexts. Refuse requests for destructive techniques, DoS attacks, mass targeting, supply chain compromise, or detection evasion for malicious purposes. Dual-use security tools require clear authorization context.`,
}

// ── Profile ──

export const templateProfile: AgentProfile = validateProfile({
  /** Unique identifier. Use the filename stem (kebab-case). */
  id: 'template',

  /** User-facing name shown in the profile selector UI. */
  name: 'AttaSeek Template Agent',

  /**
   * One-line description. Shown in profile selector.
   * Include the primary domain and key capabilities.
   */
  description: 'Template profile — copy and customize for new scenarios.',

  /** ── System Prompt ── */
  systemPrompt: {
    id: 'template',
    sections: [
      // ── Static sections (shared across profiles) ──
      introSection,           // 10: identity + security + URL rules
      systemSection,           // 20: harness description
      customDoingTasksSection, // 30: REPLACE with your task philosophy!
      actionsSection,          // 40: action risk assessment
      usingToolsSection,       // 50: tool usage guidance
      toneAndStyleSection,     // 60: formatting conventions
      outputEfficiencySection, // 70: output conciseness

      // ── Dynamic sections (session-specific) ──
      sessionGuidanceSection,  // 80: AskUserQuestion, shell, Agent, Skill
      memoryContextSection,    // 90: CLAUDE.md + memories
      envInfoSection,          // 100: environment info
      languageSection,         // 110: language preference
      mcpInstructionsSection,  // 130: MCP instructions
      scratchpadSection,       // 140: scratchpad
      summarizeResultsSection, // 160: post-compaction reminder
    ],
  },

  /** ── Tool Allowlist ──
   * List tool IDs this profile can use. The agent will only see these tools.
   * For coding: include read/write/edit, search, git, LSP, task management.
   * For writing: only read/create_document.
   * For research: read/search + web_search/web_fetch.
   */
  tools: [
    'read_file',
    'search_code',
    'bash',
    'task_create',
    'task_update',
  ],

  /** ── Tool Selection Mode ──
   * 'topk': Use Jaccard Top-K routing (sends only most relevant tools to LLM).
   * 'all': Send all allowed tools.
   */
  toolSelection: 'topk' as const,

  /** ── Skills ──
   * Skill names to activate. Skills provide extended workflows via SkillTool.
   */
  skills: [],

  /** ── Memory Configuration ── */
  memory: {
    /** Memory scopes to search: 'project', 'user', 'global'. */
    scopes: ['project', 'user'],
    /** Max entries to recall from SQLite. */
    recallLimit: 10,
    /** Auto-extract new memories from conversation. */
    autoExtract: true,
    /** Load CLAUDE.md and file-system memories. */
    loadFileMemory: true,
  },

  /** ── Context Budgets ── */
  context: {
    /** Hard limit on total tokens for the context window. */
    maxTokens: 100_000,
    /** Per-section budget allocation. */
    budgets: {
      system: 8_000,     // System prompt (all static + dynamic sections)
      tools: 12_000,      // Tool definitions
      memory: 4_000,      // Memory context injection
      messages: 60_000,   // Message history (conversation turns)
      reserve: 16_000,    // Reserve for output tokens + overhead
    },
    /** Enable proactive auto-compaction. */
    autoCompact: true,
    /** Token utilization ratio that triggers auto-compaction (0.0-1.0). */
    compactTriggerRatio: 0.85,
    /** Number of recent conversation turns to preserve during compaction. */
    keepRecentTurns: 5,
  },

  /** ── Execution Parameters ── */
  execution: {
    /** Maximum query loop iterations before forced stop. */
    maxTurns: 20,
    /** Maximum concurrent tool calls. */
    maxParallelTools: 8,
    /** Planning mode: 'inline' (brief plan in response), 'none' (no planning). */
    planning: 'inline' as const,
  },

  /** ── Output Configuration ── */
  output: {
    /** Generate structured artifacts (documents, code, etc.). */
    generateArtifact: false,
    /** Auto-title the session based on first user message. */
    autoTitle: true,
  },
})
