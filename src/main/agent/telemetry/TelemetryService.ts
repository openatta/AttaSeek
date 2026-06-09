/**
 * TelemetryService — structured internal telemetry for the agent query lifecycle.
 *
 * Emits JSONL events for every major operation in the query loop:
 * compaction stages, tool execution, token budget signals, errors, and
 * query completion. Events carry queryChainId + queryDepth for correlation
 * across a session.
 *
 * Storage: ~/.atta/seek/telemetry.jsonl (same JSONLStore pattern as AuditService).
 * Writes are fire-and-forget (non-blocking). Errors are silently dropped
 * with a console.warn to avoid crashing the query loop.
 *
 * Mirrors Claude Code's tengu_* analytics events (src/services/analytics/).
 * PII-free by design — no user messages, file paths, or tool input/output content.
 */

import { JSONLStore } from '../../store/FileStore'
import { dataDir } from '../../store/paths'
import { newId } from '../../store/id'

// ── Store ──

/** Lazy-initialized store — defers dataDir() call until first emit. */
let _store: JSONLStore | null = null

function getStore(): JSONLStore {
  if (!_store) {
    _store = new JSONLStore(`${dataDir()}/telemetry.jsonl`)
  }
  return _store
}

/**
 * Override the store for testing. Pass null to reset to default.
 * Used in test environments where Electron's app.getPath is unavailable.
 */
export function setTelemetryStore(store: JSONLStore | null): void {
  _store = store
}

// ── Event types ──

/** All telemetry event type names, prefixed agent_ for namespacing. */
export type TelemetryEventType =
  | 'agent_query_started'
  | 'agent_query_completed'
  | 'agent_query_error'
  | 'agent_fatal_error'
  | 'agent_auto_compact_succeeded'
  | 'agent_reactive_compact_succeeded'
  | 'agent_snip_compact_applied'
  | 'agent_microcompact_applied'
  | 'agent_context_collapse_applied'
  | 'agent_streaming_tool_used'
  | 'agent_streaming_tool_not_used'
  | 'agent_streaming_fallback'
  | 'agent_token_budget_completed'
  | 'agent_token_budget_continuation'
  | 'agent_max_output_recovery'
  | 'agent_fallback_model_triggered'
  | 'agent_structured_output_retry'
  | 'agent_command_processed'
  | 'agent_subagent_started'
  | 'agent_subagent_completed'
  | 'agent_permission_requested'

// ── Base event ──

export interface TelemetryEvent {
  id: string
  type: TelemetryEventType
  /** Per-session correlation ID (stable across turns). */
  queryChainId: string
  /** How many query() calls deep we are (0 = top-level, 1+ = sub-agent). */
  queryDepth: number
  /** Epoch ms when the event was emitted. */
  timestamp: number
  /** Event-specific payload. */
  payload: Record<string, unknown>
}

// ── Payload schemas (documented, not enforced at runtime) ──

export interface QueryStartedPayload {
  sessionId: string
  taskId: string
  querySource: string
  model: string
  toolCount: number
  messageCount: number
  estimatedTokens: number
}

export interface QueryCompletedPayload {
  reason: string
  turnCount: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  durationMs: number
  toolUseCount: number
}

export interface QueryErrorPayload {
  errorType: string
  errorMessage: string
  recoveryLevel: string
  turnCount: number
}

export interface CompactSucceededPayload {
  stage: string
  preCompactTokens: number
  postCompactTokens: number
  tokensFreed: number
  compressedMessageCount: number
  /** Only for LLM compaction: input/output tokens consumed by the compact call. */
  compactionInputTokens?: number
  compactionOutputTokens?: number
}

export interface ToolExecutionPayload {
  toolCount: number
  concurrentCount: number
  streamedCount: number
  batchCount: number
}

export interface TokenBudgetPayload {
  totalBudget: number
  consumedTokens: number
  consumedRatio: number
  continuationCount?: number
  turnTokens?: number
}

export interface FallbackModelPayload {
  originalModel: string
  fallbackModel: string
}

export interface StructuredOutputRetryPayload {
  attempt: number
  maxRetries: number
  schemaKeys: string[]
}

export interface CommandProcessedPayload {
  commandName: string
  shouldQuery: boolean
  modelOverride?: string
}

export interface SubagentStartedPayload {
  subagentId: string
  agentType: string
  goal: string
  parentSessionId: string
}

export interface SubagentCompletedPayload {
  subagentId: string
  status: string
  turnCount: number
  totalTokens: number
  durationMs: number
  errorMessage?: string
}

export interface PermissionRequestedPayload {
  toolCallId: string
  toolId: string
  toolName: string
  riskLevel: string
  hookDecision?: 'allow' | 'deny' | 'ask'
  finalDecision: 'allow' | 'deny'
}

// ── Service ──

export class TelemetryService {
  private queryChainId: string
  private queryDepth: number
  private sessionId: string
  private taskId: string

  constructor(sessionId: string, taskId: string, queryDepth = 0) {
    this.sessionId = sessionId
    this.taskId = taskId
    this.queryChainId = newId().slice(0, 12)
    this.queryDepth = queryDepth
  }

  /** Emit a telemetry event (fire-and-forget, non-blocking). */
  emit(type: TelemetryEventType, payload: Record<string, unknown> = {}): void {
    const event: TelemetryEvent = {
      id: newId(),
      type,
      queryChainId: this.queryChainId,
      queryDepth: this.queryDepth,
      timestamp: Date.now(),
      payload: {
        sessionId: this.sessionId,
        taskId: this.taskId,
        ...payload,
      },
    }

    // Fire-and-forget — never block the query loop on telemetry writes.
    getStore().append(event).catch(err => {
      console.warn(`[TelemetryService] write failed for ${type}:`, err.message)
    })
  }

  /** Increment depth (for sub-agent spawning). */
  incrementDepth(): void {
    this.queryDepth++
  }

  /** Get the current chain ID (for passing to sub-agents). */
  getChainId(): string {
    return this.queryChainId
  }

  /** Get the current depth. */
  getDepth(): number {
    return this.queryDepth
  }
}

// ── Singleton for top-level main-thread telemetry ──

let _mainTelemetry: TelemetryService | null = null

/** Get or create the main-thread telemetry instance (depth 0). */
export function getMainTelemetry(sessionId: string, taskId: string): TelemetryService {
  if (!_mainTelemetry) {
    _mainTelemetry = new TelemetryService(sessionId, taskId, 0)
  }
  return _mainTelemetry
}

/** Reset the main telemetry instance (new session). */
export function resetMainTelemetry(): void {
  _mainTelemetry = null
}
