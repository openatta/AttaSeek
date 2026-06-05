/**
 * ContextBuilder — assembles the full LLM context for an agent task.
 *
 * Combines:
 *   1. System prompt (base + skills + memory context)
 *   2. Recent message history (from AgentEventBus)
 *   3. Tool definitions (ToolRouter Top-K selection)
 *   4. L2 memory recall (MemoryService)
 *   5. Session artifacts summary
 *
 * Token budget: ~100K total
 *   system: ~8K | tools: ~12K | messages: ~60K | reserve: ~20K
 */

import type { LLMMessage, LLMToolDef } from './llm/LLMProvider'
import { toolRegistry } from '../tools/ToolRegistry'
import { toolRouter } from '../tools/ToolRouter'
import { memoryService } from '../memory/MemoryService'
import { skillRegistry } from '../skills/SkillRegistry'
import { artifactService } from '../artifacts/ArtifactService'
import { agentEventBus } from './AgentEventBus'
import { estimateTokens } from './compact/token-counter'
import { loadFileMemories, toMemoryEntries } from './memory/FileMemory'
import type { SessionEvent } from '../../shared/types/SessionEvent'

// ── Types ──

export interface ContextParams {
  goal: string
  sessionId: string
  projectId?: string
}

export interface AssembledContext {
  systemPrompt: string
  messages: LLMMessage[]
  tools: LLMToolDef[]
  memoryContext: string
  /** Estimated token counts per section */
  tokenUsage: TokenUsage
}

export interface TokenUsage {
  systemPrompt: number
  tools: number
  memoryContext: number
  messages: number
  total: number
  budgetLimit: number
}

// ── Token budget ──

const BUDGET = {
  systemPrompt: 8000,
  tools: 12000,
  memoryContext: 4000,
  messages: 60000,
  reserve: 20000,
  total: 100000,
  maxHistoryRounds: 20,
}

function estimateMessagesTokens(messages: LLMMessage[]): number {
  let total = 0
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      total += estimateTokens(msg.content)
    } else {
      for (const block of msg.content) {
        if (block.type === 'text') total += estimateTokens(block.text)
        else if (block.type === 'tool_use') total += estimateTokens(JSON.stringify(block.input))
        else if (block.type === 'tool_result') total += estimateTokens(block.content)
      }
    }
  }
  return total
}

function estimateToolsTokens(tools: LLMToolDef[]): number {
  return tools.reduce((sum, t) => sum + estimateTokens(t.name + t.description + JSON.stringify(t.input_schema)), 0)
}

/** Truncate messages to fit within budget, keeping most recent */
function truncateMessages(messages: LLMMessage[], maxTokens: number): LLMMessage[] {
  let total = 0
  const result: LLMMessage[] = []
  // Process from most recent to oldest
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    const tokens = estimateMessagesTokens([msg])
    if (total + tokens > maxTokens) break
    total += tokens
    result.unshift(msg)
  }
  return result
}

// ── Base system prompt ──

const BASE_SYSTEM_PROMPT = `You are AttaSeek, an AI agent workbench assistant. You help users accomplish tasks by reasoning, planning, using tools, and generating artifacts.

Core principles:
- Be thorough: understand the user's goal before acting.
- Be transparent: explain your reasoning and plan before executing.
- Use tools when needed: file operations, code search, document creation, and more.
- Generate artifacts: structured outputs like Markdown documents, code, tables, and reports.
- Verify your work: check that outputs meet the user's requirements.

When using tools:
- Read-only tools (read_file, search_code) are safe and can be used freely.
- Write tools (create_document) may require user confirmation.
- Risky tools (send_email, git_commit) always require explicit user permission.`

// ── Builder ──

export class ContextBuilder {
  constructor(
    private topK: number = 5,
    private maxRounds: number = BUDGET.maxHistoryRounds,
  ) {}

  async build(params: ContextParams): Promise<AssembledContext> {
    const { goal, sessionId, projectId } = params

    // 1. System prompt
    const skillPrompts = this.getRelevantSkillPrompts(goal)
    const memoryContext = this.getMemoryContext(sessionId, projectId, goal)
    const constraints = this.getProjectConstraints(projectId)

    let systemPrompt = [
      BASE_SYSTEM_PROMPT,
      skillPrompts.length > 0 ? `\n## Available Skills\n\n${skillPrompts.join('\n')}` : '',
      memoryContext ? `\n## Relevant Context\n\n${memoryContext}` : '',
      constraints.length > 0 ? `\n## Constraints\n\n${constraints.join('\n')}` : '',
      `\n## Current Session\nSession ID: ${sessionId}${projectId ? `\nProject ID: ${projectId}` : ''}`,
      `\nToday's date: ${new Date().toISOString().split('T')[0]}`,
    ]
      .filter(Boolean)
      .join('\n')

    // 2. Message history (recent N rounds, from AgentEventBus)
    const recentEvents = this.getRecentMessages(sessionId)
    let messages = this.eventsToMessages(recentEvents)
    // Truncate to fit within message budget
    messages = truncateMessages(messages, BUDGET.messages)

    // 3. Tools (ToolRouter Top-K) — only for file/project tasks, not pure Q&A
    const allTools = toolRegistry.list()
    const needsTools = /\b(file|code|project|document|folder|directory|search|find|read|write|commit|create)\b/i.test(goal)
    const selectedTools = needsTools ? toolRouter.selectTools(goal, allTools) : []
    const toolDefs: LLMToolDef[] = selectedTools.map((t) => ({
      name: t.id,
      description: t.description,
      input_schema: normalizeJsonSchema(t.inputSchema), // ensure proper JSON Schema format
    }))

    // 4. Artifact summaries for this session
    const artifactSummaries = this.getSessionArtifactSummaries(sessionId)
    if (artifactSummaries.length > 0) {
      const summaryText = artifactSummaries
        .map((a) => `- [${a.type}] ${a.title} (v${a.version})`)
        .join('\n')
      systemPrompt = `${systemPrompt}\n\n## Current Session Artifacts\n${summaryText}`
    }

    // ── Token accounting ──
    const tokenUsage: TokenUsage = {
      systemPrompt: estimateTokens(systemPrompt),
      tools: estimateToolsTokens(toolDefs),
      memoryContext: estimateTokens(memoryContext),
      messages: estimateMessagesTokens(messages),
      total: 0,
      budgetLimit: BUDGET.total,
    }
    tokenUsage.total = tokenUsage.systemPrompt + tokenUsage.tools + tokenUsage.memoryContext + tokenUsage.messages

    if (tokenUsage.total > BUDGET.total) {
      console.warn(`[ContextBuilder] token budget exceeded: ${tokenUsage.total}/${BUDGET.total}`)
    }

    return { systemPrompt, messages, tools: toolDefs, memoryContext, tokenUsage }
  }

  // ── Private helpers ──

  private getRelevantSkillPrompts(goal: string): string[] {
    const allSkills = skillRegistry.list()
    if (allSkills.length === 0) return []

    // Suggest skills relevant to the goal
    const goalLower = goal.toLowerCase()
    const relevant = allSkills.filter((s) => {
      const text = `${s.name} ${s.description}`.toLowerCase()
      return goalLower.split(/\s+/).some((w) => w.length > 2 && text.includes(w))
    })

    return relevant.map((s) => {
      let prompt = `### ${s.name}\n${s.description}\n`
      if (s.defaultPlan) prompt += `Plan: ${s.defaultPlan}\n`
      if (s.verificationRules.length > 0) {
        prompt += `Verification:\n${s.verificationRules.map((r) => `  - ${r}`).join('\n')}\n`
      }
      return prompt
    })
  }

  private getMemoryContext(sessionId: string, projectId?: string, goal?: string): string {
    const parts: string[] = []

    // L2: SQLite memory
    const entries = memoryService.recall({
      scopeId: projectId || sessionId,
      limit: 10,
      query: goal,
    })
    if (entries.length > 0) {
      parts.push(entries.map((e) => `- [${e.type}] ${e.content}`).join('\n'))
    }

    // L0: File system memory (CLAUDE.md + .attaseek/memory/*.md)
    if (projectId) {
      try {
        const fileEntries = loadFileMemories(projectId)
        if (fileEntries.length > 0) {
          const memEntries = toMemoryEntries(fileEntries, 'project', projectId)
          parts.push(memEntries.map((e) => `- [${e.type}] ${e.content.slice(0, 500)}`).join('\n'))
        }
      } catch { /* file memory is best-effort */ }
    }

    return parts.join('\n')
  }

  private getProjectConstraints(_projectId?: string): string[] {
    // TODO: load project-level constraints from settings or memory
    return []
  }

  private getRecentMessages(sessionId: string): SessionEvent[] {
    const all = agentEventBus.getHistory(sessionId)
    const maxMessages = this.maxRounds * 2 // Each round = user + assistant
    const result: SessionEvent[] = []
    let messageCount = 0
    // Iterate from most recent backwards, counting only message-type events,
    // but keeping all intermediate events (tool calls, permissions, etc.) for context
    for (let i = all.length - 1; i >= 0; i--) {
      const e = all[i]
      if (e.type === 'UserMessage' || e.type === 'AgentMessage') {
        messageCount++
      }
      result.unshift(e)
      if (messageCount >= maxMessages) break
    }
    return result
  }

  private getSessionArtifactSummaries(sessionId: string) {
    return artifactService.listSummaries(sessionId)
  }

  /** Convert SessionEvents to LLM message format */
  private eventsToMessages(events: SessionEvent[]): LLMMessage[] {
    const messages: LLMMessage[] = []
    for (const event of events) {
      switch (event.type) {
        case 'UserMessage': {
          const payload = event.payload as { content: string }
          messages.push({ role: 'user', content: payload.content })
          break
        }
        case 'AgentMessage': {
          const payload = event.payload as { content: string; reasoning?: string }
          let content = payload.content
          if (payload.reasoning) {
            content = `[Reasoning: ${payload.reasoning}]\n\n${content}`
          }
          messages.push({ role: 'assistant', content })
          break
        }
        // Tool calls and artifacts are handled in-stream; skip for context
      }
    }
    return messages
  }
}

/** Ensure a schema is in proper JSON Schema format (type: object, properties: {...}).  If it's a simplified format like { field: 'string' }, convert it. */
function normalizeJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
  // Already has type: 'object' → assume proper JSON Schema
  if (schema.type === 'object' && schema.properties) return schema

  // Simplified format: { fieldName: 'string', fieldName2: 'number' } → convert
  const properties: Record<string, { type: string }> = {}
  const required: string[] = []
  for (const [key, value] of Object.entries(schema)) {
    if (typeof value === 'string') {
      properties[key] = { type: value }
      required.push(key)
    }
  }
  if (Object.keys(properties).length === 0) return schema // can't normalize, pass through

  return { type: 'object', properties, required }
}

/** Singleton — default Top-K=5, 20 rounds history */
export const contextBuilder = new ContextBuilder()
