/**
 * QueryDeps — dependency injection container for the query loop.
 *
 * Mirrors Claude Code's QueryDeps pattern (src/query/deps.ts). The inner
 * query-loop is a pure AsyncGenerator — all side effects flow through
 * this interface, making the loop independently testable.
 *
 * In production, call `productionDeps()` to wire real implementations.
 * In tests, pass a partial mock with only the deps you need to override.
 *
 * Phase A: interface definition only. Implementations are wired in Phase B.
 */

import type { LLMContentBlock, LLMMessage } from '../llm/ModelProvider'
import type { AgentTask } from '../../../shared/types/AgentTask'
import type { AgentProfile } from '../profile/AgentProfile'

// ── Re-export compact types for deps signatures ──

export interface MicrocompactResult {
  messages: LLMMessage[]
  /** Non-zero when trimming occurred — feeds autocompact hysteresis tracking */
  compactedCount: number
  /**
   * Pending server-side cache edits (feature gated: CACHED_MICROCOMPACT).
   * Deferred until after API response so actual cache_deleted_input_tokens
   * are available.
   */
  pendingCacheEdits?: CacheEdit[]
}

export interface CacheEdit {
  toolUseId: string
  newContent: string
}

export interface AutocompactResult {
  messages: LLMMessage[]
  summary: string
  tokensFreed: number
  compressedCount: number
}

// ── LLM call model (simplified from full LLMChatParams — the query loop
//    adds system prompt + context wrapping before handing off) ──

export interface CallModelParams {
  systemPrompt: string
  messages: LLMMessage[]
  tools: Array<{
    name: string
    description: string
    input_schema: Record<string, unknown>
  }>
  model?: string
  signal: AbortSignal
  maxOutputTokens?: number
  skipCacheWrite?: boolean
  taskBudget?: { total: number }
  /** OpenAI-compatible tool_choice param. 'any'/'tool' → force tool use. Default 'auto'. */
  toolChoice?: 'auto' | 'any' | 'tool' | 'none'
}

export interface CallModelChunk {
  type: 'text_delta' | 'tool_use_start' | 'tool_use_delta' | 'content_block_stop' | 'message_stop'
  text?: string
  id?: string
  name?: string
  input_json?: string
  index?: number
}

export type CallModelChunkCallback = (chunk: CallModelChunk) => void

export interface CallModelResult {
  content: LLMContentBlock[]
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence'
  usage: { inputTokens: number; outputTokens: number }
}

// ── ToolUseContext (placeholder — full definition in Phase D) ──

/**
 * Mutable context shared across tool executions within a single query turn.
 * Each tool can modify this context (via contextModifier) to affect
 * subsequent tool behaviour.
 *
 * Placeholder in Phase A — populated with real fields in Phase D.
 */
export interface ToolUseContext {
  /** Shared abort controller for this turn's tool executions */
  abortController: AbortController
  /** Child controller — aborting this kills sibling Bash processes but NOT the parent turn */
  siblingAbortController: AbortController
  /** Currently in-progress tool use IDs (set → UI shows spinner per tool) */
  setInProgressToolUseIDs: (fn: (prev: Set<string>) => Set<string>) => void
  /** Agent identifier (non-empty only for sub-agents) */
  agentId?: string
  /** Query chain tracking — chainId + depth, undefined for first turn */
  queryTracking?: {
    chainId: string
    depth: number
  }
  /** Content replacement state (feature gated — tool result budget enforcement) */
  contentReplacementState?: unknown
}

// ── The DI container ──

/** Full dependency interface for the inner query loop. */
export interface QueryDeps {
  /** Call the LLM provider. Wraps streaming + retry + fallback. */
  callModel: (params: CallModelParams, onChunk: CallModelChunkCallback) => Promise<CallModelResult>

  /** Microcompact — per-turn tool result trimming + cached edits. */
  microcompact: (messages: LLMMessage[], context: ToolUseContext, querySource: string) => Promise<MicrocompactResult>

  /** Autocompact — LLM-based conversation summarization when budget exceeded. */
  autocompact: (messages: LLMMessage[], context: ToolUseContext) => Promise<AutocompactResult>

  /** Snip compact — remove middle conversation, keep head+tail. Feature gated. */
  snipCompact?: (messages: LLMMessage[]) => {
    messages: LLMMessage[]
    tokensFreed: number
    boundaryMessage?: { role: 'user'; content: string }
  }

  /** Context collapse — non-destructive collapse with commit log replay. Feature gated. */
  collapseContext?: (messages: LLMMessage[], context: ToolUseContext, querySource: string) => Promise<{
    messages: LLMMessage[]
  }>

  /** Async memory prefetch — starts early, consumed at turn end. Returns dispose handle. */
  memoryPrefetch?: () => {
    settledAt: Promise<void>
    messages: LLMMessage[]
    dispose: () => void
  }

  /** Generate a UUID v4 (injected for deterministic testing). */
  uuid: () => string
}

/**
 * Create the production DI container wired to real implementations.
 *
 * Wires callModel → modelProviderRegistry, microcompact → ContextCompactor,
 * autocompact → compactConversation, uuid → newId from store/id.
 *
 * Override any dep via the optional overrides parameter (for testing).
 */
export function productionDeps(overrides?: Partial<QueryDeps>): QueryDeps {
  const base: QueryDeps = {
    callModel: async (params, onChunk) => {
      const { modelProviderRegistry } = await import('../llm/ModelProviderRegistry')
      const provider = modelProviderRegistry.getDefault()
      if (!provider) throw new Error('No LLM provider configured')
      return provider.chatStream(
        {
          systemPrompt: params.systemPrompt,
          messages: params.messages,
          tools: params.tools,
          signal: params.signal,
          model: params.model,
        },
        (chunk) => {
          onChunk({
            type: chunk.type,
            text: 'text' in chunk ? chunk.text : undefined,
            id: 'id' in chunk ? chunk.id : undefined,
            name: 'name' in chunk ? chunk.name : undefined,
            input_json: 'input_json' in chunk ? chunk.input_json : undefined,
            index: 'index' in chunk ? chunk.index : undefined,
          })
        },
      )
    },

    microcompact: async (messages, _context, _querySource) => {
      const { microcompact } = await import('../compact/ContextCompactor')
      try {
        const compacted = microcompact(messages as any)
        return { messages: compacted as any, compactedCount: 0 }
      } catch {
        return { messages, compactedCount: 0 }
      }
    },

    autocompact: async (messages, _context) => {
      const { compactConversation } = await import('../compact/ContextCompactor')
      // Autocompact needs profile — use a lightweight default
      const profile = (await import('../profile/profiles/coding-profile')).codingProfile
      const result = await compactConversation(messages, profile, undefined)
      return {
        messages: result.compactedMessages,
        summary: result.summary,
        tokensFreed: result.tokenSaved,
        compressedCount: result.compactedCount,
      }
    },

    uuid: () => {
      const { newId } = require('../../store/id')
      return newId()
    },
  }

  if (overrides) {
    return { ...base, ...overrides }
  }
  return base
}

// ── Convenience types for partial DI (test mocks) ──

/** Partial deps for testing — only override what you need. */
export type PartialQueryDeps = Partial<QueryDeps>

/**
 * Merge test overrides onto production defaults.
 * Unspecified deps fall back to production (or throw if not yet wired).
 */
export function withTestDeps(overrides: PartialQueryDeps): QueryDeps {
  return { ...productionDeps(), ...overrides }
}
