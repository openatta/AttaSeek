/**
 * PromptTemplate — section-based system prompt assembly engine.
 *
 * Sections are ordered by priority, filtered by condition, and rendered
 * either as static strings or dynamic functions of PromptContext.
 *
 * Inspired by Claude Code's systemPromptSections.ts pattern.
 */

import type { AgentProfile } from '../profile/AgentProfile'
import type { SkillManifest } from '../../../shared/types/Skill'
import type { ToolManifest } from '../../../shared/types/Tool'
import type { MemoryEntry } from '../../../shared/types/Memory'

// ── Types ──

export interface PromptContext {
  profile: AgentProfile
  skills: SkillManifest[]
  tools: ToolManifest[]
  memories: MemoryEntry[]
  sessionId: string
  projectId?: string
  date: string
  goal: string
  compactSummary?: string  // populated after compaction
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
