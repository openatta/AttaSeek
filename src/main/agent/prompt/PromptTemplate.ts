/**
 * PromptTemplate — section-based system prompt assembly engine.
 *
 * Sections are ordered by priority, filtered by condition, and rendered
 * either as static strings or dynamic functions of PromptContext.
 *
 * Inspired by Claude Code's systemPromptSections.ts pattern.
 *
 * ## Section priority layout (matches Claude Code's ordering):
 *
 *   Static (cacheable across sessions):
 *    10  intro              Identity + security boundary + URL rules
 *    20  system             Harness description (markdown, permissions, hooks, compression)
 *    30  doing-tasks        Task execution philosophy (15+ behavioral principles)
 *    40  actions            Action risk assessment (reversibility, blast radius)
 *    50  using-tools        Tool usage guidance (dedicated tools over Bash, parallelism)
 *    60  tone-and-style     Formatting conventions (emoji, code refs, GitHub format)
 *    70  output-efficiency  Conciseness (go straight to the point)
 *   --- cache boundary ---
 *   Dynamic (session/user specific):
 *    80  session-guidance   AskUserQuestion, shell shortcut, Agent/Skill guidance
 *    90  memory-context     CLAUDE.md, memories, session memory, compaction summary
 *   100  env-info           Working dir, git, platform, shell, OS, model, cutoff
 *   110  language           Language preference (conditional)
 *   120  output-style       Output style (conditional)
 *   130  mcp-instructions   MCP server instructions (conditional)
 *   140  scratchpad         Scratchpad directory (conditional)
 *   160  summarize-results  Post-compaction content save reminder
 */

import type { AgentProfile } from '../profile/AgentProfile'
import type { SkillManifest } from '../../../shared/types/Skill'
import type { ToolManifest } from '../../../shared/types/Tool'
import type { MemoryEntry } from '../../../shared/types/Memory'

// ── Types ──

/** MCP server instruction block injected into the system prompt. */
export interface MCPInstructionBlock {
  serverName: string
  instructions: string
}

export interface PromptContext {
  // ── Profile ──
  profile: AgentProfile

  // ── Tools & Skills ──
  tools: ToolManifest[]
  skills: SkillManifest[]

  // ── Session ──
  sessionId: string
  projectId?: string
  date: string
  goal: string

  // ── Memory ──
  memories: MemoryEntry[]
  /** L1 session memory content (auto-maintained) */
  sessionMemory?: string
  /** Compaction summary from previous compaction pass */
  compactSummary?: string

  // ── CLAUDE.md ──
  /** Combined CLAUDE.md content from user/project/local layers */
  claudeMd?: string

  // ── Environment (for env-info section) ──
  /** Primary working directory */
  cwd?: string
  /** Whether CWD is a git repository */
  isGit?: boolean
  /** Additional working directories */
  additionalWorkingDirs?: string[]
  /** Platform (darwin, linux, win32) */
  platform?: string
  /** Shell name (zsh, bash, etc.) */
  shell?: string
  /** OS version string (e.g. "Darwin 25.4.0") */
  osVersion?: string

  // ── Model identity (for env-info section) ──
  /** Human-readable model description (e.g. "the model named Claude Sonnet 4.6") */
  modelDescription?: string
  /** Knowledge cutoff date (e.g. "August 2025") */
  knowledgeCutoff?: string
  /** Model family IDs hint (e.g. "Model IDs — Opus: '...', Sonnet: '...'") */
  modelFamilyIds?: string

  // ── Conditional sections ──
  /** Language preference (e.g. "Chinese", "Japanese") */
  languagePreference?: string
  /** Output style name (if configured) */
  outputStyle?: string
  /** Output style prompt body */
  outputStylePrompt?: string
  /** MCP server instruction blocks */
  mcpInstructions?: MCPInstructionBlock[]
  /** Scratchpad directory path (if enabled) */
  scratchpadDir?: string
  /** Token budget target description (if set) */
  tokenBudget?: string
}

export interface PromptSection {
  /** Unique name for debugging */
  name: string
  /** Lower = earlier in output */
  priority: number
  /** Static text or dynamic generator */
  content: string | ((ctx: PromptContext) => string)
  /** Optional condition — only rendered if true. Undefined = always render. */
  condition?: (ctx: PromptContext) => boolean
}

export interface PromptTemplate {
  /** Template id (matches profile id) */
  id: string
  /** Ordered sections */
  sections: PromptSection[]
}

// ── Render engine ──

export function renderPrompt(template: PromptTemplate, ctx: PromptContext): string {
  const sorted = [...template.sections].sort((a, b) => a.priority - b.priority)
  const parts: string[] = []

  for (const section of sorted) {
    if (section.condition && !section.condition(ctx)) continue
    const text = typeof section.content === 'function'
      ? section.content(ctx)
      : section.content
    if (text) parts.push(text.trim())
  }

  return parts.join('\n\n')
}
