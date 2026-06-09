/**
 * ContextAssembler — unified LLM context assembly.
 *
 * Collects context from all sources (git, memory, attachments, tools, messages)
 * and delegates system prompt assembly to PromptTemplate.renderPrompt().
 *
 * The hardcoded BASE_SYSTEM_PROMPT has been removed — prompt content is now
 * owned by the profile's PromptTemplate sections (see src/main/agent/prompt/).
 *
 * Context layering (mirrors Claude Code):
 *   - userContext: CLAUDE.md files, memory files, skill prompts → injected
 *     at the USER message boundary (prepended to user content)
 *   - systemContext: git status, date, OS info → injected at the END of
 *     the system prompt (appended after tool definitions)
 *
 * Token budget: ~100K total
 *   systemPrompt: ~8K | tools: ~12K | memoryContext: ~4K | messages: ~60K | reserve: ~20K
 */

import { toolRegistry } from '../../tools/ToolRegistry'
import { toolRouter } from '../../tools/ToolRouter'
import { memoryService } from '../../memory/MemoryService'
import { skillRegistry } from '../../skills/SkillRegistry'
import { agentEventBus } from '../AgentEventBus'
import { estimateTokens } from '../compact/token-counter'
import { collectGitContext, formatGitContext } from './GitContext'
import { loadFileMemories, toMemoryEntries } from '../memory/FileMemory'
import { renderPrompt, type PromptContext } from '../prompt/PromptTemplate'
import type { AgentProfile } from '../profile/AgentProfile'
import type { LLMMessage, LLMToolDef } from '../llm/ModelProvider'
import type { SessionEvent } from '../../../shared/types/SessionEvent'
import * as fs from 'fs'
import * as path from 'path'

// ── Types ──

export interface ContextAssemblerConfig {
  /** Maximum tools to select via Top-K routing. */
  topK: number
  /** Maximum conversation rounds to include. */
  maxRounds: number
  /** Working directory for git context. */
  cwd?: string
  /** Whether to include git context. */
  includeGitContext: boolean
  /** Whether to include file-system memories. */
  includeFileMemories: boolean
}

/** Lightweight tool descriptor used in DI deps (subset of ToolManifest). */
export interface ToolSummary {
  id: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/**
 * Injectable service dependencies for ContextAssembler.
 */
export interface ContextAssemblerDeps {
  listTools?: () => ToolSummary[]
  selectTools?: (goal: string, tools: ToolSummary[]) => Array<{ id: string }>
  recallMemories?: (params: { scopeId: string; limit: number; query?: string }) => Promise<Array<{ type: string; content: string }>>
  listSkills?: () => Array<{ name: string; description: string; defaultPlan?: string }>
  getSessionEvents?: (sessionId: string) => Array<{ type: string; payload: unknown }>
}

export interface ContextParams {
  goal: string
  sessionId: string
  projectId?: string
  attachments?: string[]
  /** The active agent profile — used for system prompt rendering. */
  profile: AgentProfile
  /** Additional working directories (e.g., from skill contexts, worktrees). */
  additionalWorkingDirs?: string[]
  /** Current model identifier (e.g. "claude-sonnet-4-6") for env-info. */
  modelId?: string
  /** Human-readable model provider name for env-info. */
  modelProvider?: string
  /** Model knowledge cutoff date (e.g. "August 2025"). */
  knowledgeCutoff?: string
  /** Model family IDs hint (e.g. "Model IDs — Opus: 'xxx', Sonnet: 'yyy'"). */
  modelFamilyIds?: string
  /** Whether fork-mode subagents are enabled. */
  forkSubagentEnabled?: boolean
}

export interface AssembledContext {
  /** Complete system prompt (rendered from PromptTemplate). */
  systemPrompt: string
  /** Message history for the LLM call. */
  messages: LLMMessage[]
  /** Selected tool definitions. */
  tools: LLMToolDef[]
  /** Raw memory context string. */
  memoryContext: string
  /** Per-section token accounting. */
  tokenUsage: SectionTokenUsage
  /** User context map (for prepend to user message). */
  userContext: Record<string, string>
  /** System context map (for append to system prompt). */
  systemContext: Record<string, string>
}

export interface SectionTokenUsage {
  systemPrompt: number
  tools: number
  memoryContext: number
  messages: number
  userContext: number
  systemContext: number
  total: number
  budgetLimit: number
}

// ── Token budget ──

const BUDGET = {
  systemPrompt: 8_000,
  tools: 12_000,
  memoryContext: 4_000,
  messages: 60_000,
  userContext: 4_000,
  systemContext: 1_000,
  reserve: 15_000,
  total: 100_000,
  maxRounds: 20,
}

// ── Default config ──

const DEFAULT_CONFIG: ContextAssemblerConfig = {
  topK: 5,
  maxRounds: BUDGET.maxRounds,
  includeGitContext: true,
  includeFileMemories: true,
}

// ── Assembler ──

export class ContextAssembler {
  private config: ContextAssemblerConfig
  private deps: ContextAssemblerDeps

  constructor(config: Partial<ContextAssemblerConfig> = {}, deps?: ContextAssemblerDeps) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.deps = deps ?? {}
  }

  /**
   * Assemble the full LLM context for a query.
   *
   * System prompt assembly is delegated to renderPrompt(template, ctx)
   * where the template comes from the active AgentProfile.
   */
  async assemble(params: ContextParams): Promise<AssembledContext> {
    const { goal, sessionId, projectId, attachments, profile } = params

    // ── System context (git, OS, date) ──
    const systemContext: Record<string, string> = {}
    let isGit = false
    if (this.config.includeGitContext) {
      const gitState = collectGitContext(this.config.cwd)
      isGit = gitState.isGit
      if (gitState.isGit) {
        systemContext.git = formatGitContext(gitState)
      }
    }
    systemContext.os = `${process.platform} ${process.getSystemVersion?.() ?? ''}`
    systemContext.date = new Date().toISOString().split('T')[0]

    // ── User context (CLAUDE.md, memories, skills) ──
    const userContext: Record<string, string> = {}
    const memoryContext = await this.buildMemoryContext(sessionId, projectId, goal)
    if (memoryContext) userContext.memory = memoryContext

    const skillContext = this.buildSkillContext(goal)
    if (skillContext) userContext.skills = skillContext

    // ── Tools ──
    const toolDefs = this.buildToolDefs(goal)

    // ── Build PromptContext from the real profile ──
    const promptCtx = this.buildPromptContext({
      params,
      profile,
      systemContext,
      userContext,
      tools: toolDefs,
      isGit,
    })

    // ── System prompt (delegated to PromptTemplate) ──
    const systemPrompt = renderPrompt(profile.systemPrompt, promptCtx)

    // ── Messages ──
    const recentEvents = this.getRecentMessages(sessionId)
    let messages = this.eventsToMessages(recentEvents)
    messages = this.truncateMessages(messages, BUDGET.messages)

    // Prepend attachment messages if any
    if (attachments && attachments.length > 0) {
      const attachMsg = this.buildAttachmentContext(attachments)
      if (attachMsg) messages = [attachMsg, ...messages]
    }

    // ── Token accounting ──
    const tokenUsage: SectionTokenUsage = {
      systemPrompt: estimateTokens(systemPrompt),
      tools: this.estimateToolsTokens(toolDefs),
      memoryContext: estimateTokens(userContext.memory || ''),
      messages: this.estimateMessagesTokens(messages),
      userContext: estimateTokens(Object.values(userContext).join('\n')),
      systemContext: estimateTokens(Object.values(systemContext).join('\n')),
      total: 0,
      budgetLimit: BUDGET.total,
    }
    tokenUsage.total =
      tokenUsage.systemPrompt + tokenUsage.tools +
      tokenUsage.memoryContext + tokenUsage.messages +
      tokenUsage.userContext + tokenUsage.systemContext

    if (tokenUsage.total > BUDGET.total) {
      console.warn(`[ContextAssembler] token budget exceeded: ${tokenUsage.total}/${BUDGET.total}`)
    }

    return {
      systemPrompt,
      messages,
      tools: toolDefs,
      memoryContext: userContext.memory || '',
      tokenUsage,
      userContext,
      systemContext,
    }
  }

  /**
   * Build a PromptContext for renderPrompt() from the real profile and collected data.
   */
  private buildPromptContext(input: {
    params: ContextParams
    profile: AgentProfile
    systemContext: Record<string, string>
    userContext: Record<string, string>
    tools: LLMToolDef[]
    isGit: boolean
  }): PromptContext {
    const { params, profile, tools, isGit } = input

    return {
      profile,
      tools: tools.map(t => ({
        id: t.name,
        pluginId: 'builtin',
        name: t.name,
        description: t.description,
        riskLevel: 'read' as const,
        category: 'code' as const,
        permissionPolicy: { default: 'allow' as const, requirePreview: false, allowAlways: false },
        inputSchema: t.input_schema,
        outputSchema: {},
      })),
      skills: [],
      sessionId: params.sessionId,
      projectId: params.projectId,
      date: new Date().toISOString().split('T')[0],
      goal: params.goal,
      memories: [],
      cwd: this.config.cwd || process.cwd(),
      isGit,
      platform: process.platform,
      shell: process.env.SHELL?.split('/').pop() || 'unknown',
      osVersion: `${process.platform} ${process.getSystemVersion?.() ?? ''}`,
      additionalWorkingDirs: params.additionalWorkingDirs,
      modelDescription: params.modelId
        ? `You are powered by the model ${params.modelId}${params.modelProvider ? ` (${params.modelProvider})` : ''}.`
        : undefined,
      knowledgeCutoff: params.knowledgeCutoff,
      modelFamilyIds: params.modelFamilyIds,
      forkSubagentEnabled: params.forkSubagentEnabled,
      // Worktree detection: in a git worktree, .git is a file (not a directory)
      isWorktree: (() => {
        try {
          const cwd = this.config.cwd || process.cwd()
          const gitPath = path.join(cwd, '.git')
          return fs.existsSync(gitPath) && fs.statSync(gitPath).isFile()
        } catch { return false }
      })(),
      worktreeMessage: 'This is a git worktree — an isolated copy of the repository. Run all commands from this directory. Do NOT cd to the original repository root.',
    }
  }

  // ── Memory context ──

  private async buildMemoryContext(
    sessionId: string,
    projectId?: string,
    goal?: string,
  ): Promise<string> {
    const parts: string[] = []

    // L2: SQLite memory
    const recall = this.deps.recallMemories ?? (async (params) => {
      const entries = await memoryService.recall(params)
      return entries.map(e => ({ type: e.type, content: e.content }))
    })
    const entries = await recall({
      scopeId: projectId || sessionId,
      limit: 10,
      query: goal,
    })
    if (entries.length > 0) {
      parts.push(entries.map(e => `- [${e.type}] ${e.content}`).join('\n'))
    }

    // L0: File system memory
    if (this.config.includeFileMemories && projectId) {
      try {
        const fileEntries = await loadFileMemories(projectId)
        if (fileEntries.length > 0) {
          const memEntries = toMemoryEntries(fileEntries, 'project', projectId)
          parts.push(memEntries.map(e => `- [${e.type}] ${e.content.slice(0, 500)}`).join('\n'))
        }
      } catch { /* best-effort */ }
    }

    return parts.join('\n')
  }

  // ── Skill context ──

  private buildSkillContext(goal: string): string {
    const listSkills = this.deps.listSkills ?? (() => skillRegistry.list().map(s => ({
      name: s.name,
      description: s.description,
      defaultPlan: (s as any).defaultPlan,
    })))
    const allSkills = listSkills()
    if (allSkills.length === 0) return ''

    const goalLower = goal.toLowerCase()
    const relevant = allSkills.filter(s => {
      const text = `${s.name} ${s.description}`.toLowerCase()
      return goalLower.split(/\s+/).some(w => w.length > 2 && text.includes(w))
    })

    return relevant.map(s => {
      let prompt = `### ${s.name}\n${s.description}\n`
      if (s.defaultPlan) prompt += `Plan: ${s.defaultPlan}\n`
      return prompt
    }).join('\n')
  }

  // ── Tool selection ──

  private buildToolDefs(goal: string): LLMToolDef[] {
    const needsTools = /\b(file|code|project|document|folder|directory|search|find|read|write|commit|create|edit|run|bash|shell|exec|test)\b/i.test(goal)
    if (!needsTools) return []

    const listTools = this.deps.listTools ?? (() => toolRegistry.list().map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })))
    const selectTools = this.deps.selectTools ?? ((g, tools) => {
      return toolRouter.selectTools(g, tools).map(t => ({ id: t.id }))
    })

    const allTools = listTools()
    const selected = selectTools(goal, allTools)
    return selected.map(t => {
      const full = allTools.find(at => at.id === t.id)
      return {
        name: t.id,
        description: full?.description ?? '',
        input_schema: normalizeJsonSchema(full?.inputSchema ?? {}),
      }
    })
  }

  // ── Message history ──

  private getRecentMessages(sessionId: string): SessionEvent[] {
    const getEvents = this.deps.getSessionEvents ?? ((sid: string) => agentEventBus.getHistory(sid))
    const all = getEvents(sessionId) as SessionEvent[]
    const maxMsgs = this.config.maxRounds * 2
    const result: SessionEvent[] = []
    let msgCount = 0
    for (let i = all.length - 1; i >= 0; i--) {
      const e = all[i]
      if (e.type === 'UserMessage' || e.type === 'AgentMessage') msgCount++
      result.unshift(e)
      if (msgCount >= maxMsgs) break
    }
    return result
  }

  private eventsToMessages(events: SessionEvent[]): LLMMessage[] {
    const messages: LLMMessage[] = []
    for (const event of events) {
      switch (event.type) {
        case 'UserMessage': {
          const p = event.payload as { content: string }
          messages.push({ role: 'user', content: p.content })
          break
        }
        case 'AgentMessage': {
          const p = event.payload as { content: string; reasoning?: string }
          let content = p.content
          if (p.reasoning) content = `[Reasoning: ${p.reasoning}]\n\n${content}`
          messages.push({ role: 'assistant', content })
          break
        }
      }
    }
    return messages
  }

  // ── Attachment context ──

  private buildAttachmentContext(filePaths: string[]): LLMMessage | null {
    if (filePaths.length === 0) return null
    const paths = filePaths.slice(0, 10).join(', ')
    return { role: 'user', content: `[Attached files: ${paths}]` }
  }

  // ── Token helpers ──

  private truncateMessages(messages: LLMMessage[], maxTokens: number): LLMMessage[] {
    let total = 0
    const result: LLMMessage[] = []
    for (let i = messages.length - 1; i >= 0; i--) {
      const tokens = this.estimateMessageTokens(messages[i])
      if (total + tokens > maxTokens) break
      total += tokens
      result.unshift(messages[i])
    }
    return result
  }

  private estimateMessageTokens(msg: LLMMessage): number {
    if (typeof msg.content === 'string') return estimateTokens(msg.content)
    return msg.content.reduce((sum, b) => {
      if (b.type === 'text') return sum + estimateTokens(b.text)
      if (b.type === 'tool_use') return sum + estimateTokens(JSON.stringify(b.input))
      if (b.type === 'tool_result') return sum + estimateTokens(b.content)
      return sum
    }, 0)
  }

  private estimateMessagesTokens(messages: LLMMessage[]): number {
    return messages.reduce((s, m) => s + this.estimateMessageTokens(m), 0)
  }

  private estimateToolsTokens(tools: LLMToolDef[]): number {
    return tools.reduce((s, t) => s + estimateTokens(t.name + t.description + JSON.stringify(t.input_schema)), 0)
  }
}

// ── JSON Schema normalization ──

function normalizeJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (schema.type === 'object' && schema.properties) return schema
  const properties: Record<string, { type: string }> = {}
  const required: string[] = []
  for (const [key, value] of Object.entries(schema)) {
    if (typeof value === 'string') {
      properties[key] = { type: value }
      required.push(key)
    }
  }
  if (Object.keys(properties).length === 0) return schema
  return { type: 'object', properties, required }
}

// ── Singleton ──

export const contextAssembler = new ContextAssembler()
