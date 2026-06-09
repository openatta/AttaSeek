/**
 * MessageTypes — extended message discriminated union types.
 *
 * Supplements the existing SessionEvent system with message variants
 * needed for advanced features (compaction, tool progress, streaming).
 * These types are used internally by the agent loop; the renderer sees
 * them through the existing SessionEvent IPC channel.
 *
 * Mirrors Claude Code's message type system (src/types/message.js).
 *
 * Phase A: type definitions only. Integration into AgentEventBus
 * and renderer rendering deferred to later phases.
 */

import type { LLMContentBlock, LLMMessage } from '../llm/ModelProvider'

// ── Stream events (LLM response streaming) ──

/**
 * Events emitted during LLM streaming. Expands the existing LLMChunk
 * with additional lifecycle events needed by the query loop.
 */
export type StreamEventType =
  | 'text_delta'
  | 'tool_use_start'
  | 'tool_use_delta'
  | 'tool_use_stop'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_stop'
  | 'stream_error'
  | 'stream_request_start'
  | 'compact_boundary'

export interface StreamEvent {
  type: StreamEventType
  /** For text_delta — the incremental text */
  text?: string
  /** Content block index (0-based, per message) */
  index?: number
  /** For tool_use_start — unique tool use ID */
  id?: string
  /** For tool_use_start — tool name */
  name?: string
  /** For tool_use_delta — partial JSON input */
  input_json?: string
  /** For tool_use_stop — complete parsed input */
  tool_input?: unknown
  /** For content_block_start — content block type */
  content_block_type?: 'text' | 'tool_use'
  /** For stream_error — error description */
  error?: string
  /** For compact_boundary — compaction summary */
  summary?: string
}

// ── Tombstone message (compaction placeholder) ──

/**
 * A TombstoneMessage replaces original messages that were compacted away.
 * It preserves the message count and token count for UI continuity,
 * but carries only a summary, not the original content.
 *
 * The UI renders tombstones as a single collapsed row ("… N messages compacted").
 */
export interface TombstoneMessage {
  readonly type: 'tombstone'
  /** IDs of the messages this tombstone replaces */
  originalMessageIds: string[]
  /** Human-readable summary of what was compacted away */
  summary: string
  /** Approximate token count of the removed messages */
  tokenCount: number
  /** Timestamp when the tombstone was created */
  createdAt: number
}

// ── Tool use summary message (compaction detail) ──

/**
 * Summarises tool_use blocks from a compacted turn. Used by auto-compact
 * to give the LLM a high-level view of what tools ran and what they produced,
 * without keeping the full tool input/output in context.
 */
export interface ToolUseSummaryMessage {
  readonly type: 'tool_use_summary'
  /** Which turn index (0-based) this summarises */
  turnIndex: number
  /** Compressed tool use entries */
  toolUses: ToolUseSummaryEntry[]
  /** When the summary was generated */
  createdAt: number
}

export interface ToolUseSummaryEntry {
  /** Tool name */
  toolName: string
  /** Abbreviated input (≤100 chars) */
  inputSummary: string
  /** Abbreviated output (≤200 chars) */
  outputSummary: string
  /** Whether the tool execution succeeded */
  success: boolean
}

// ── Progress message (tool execution real-time feedback) ──

/**
 * Real-time progress updates from long-running tool executions.
 * Emitted by tools via onProgress callbacks, rendered as inline
 * progress bars or status indicators in the conversation.
 */
export interface ProgressMessage {
  readonly type: 'progress'
  /** The tool call this progress belongs to */
  toolCallId: string
  /** Tool name */
  toolName: string
  /** Current execution stage */
  stage: ProgressStage
  /** Human-readable progress description */
  message: string
  /** 0–100, only meaningful when stage is 'running' */
  percentComplete?: number
  /** When the progress update was emitted */
  timestamp: number
}

export type ProgressStage =
  | 'started'     // Tool execution just began
  | 'running'     // Tool is actively doing work
  | 'blocked'     // Tool is blocked on user input (permission dialog)
  | 'finishing'   // Tool is wrapping up
  | 'completed'   // Tool finished successfully
  | 'failed'      // Tool finished with error

// ── Request start event ──

/** Emitted at the start of each LLM API call within a query loop iteration. */
export interface RequestStartEvent {
  readonly type: 'stream_request_start'
  /** Which iteration of the query loop this is (0-indexed) */
  turnIndex: number
  /** When the request was sent */
  timestamp: number
}

// ── Unified message types (for query-loop yield) ──

/**
 * Messages that the query loop can yield. This is the extended set
 * beyond what SessionEvent covers today.
 */
export type LoopMessage =
  | LLMMessage
  | StreamEvent
  | TombstoneMessage
  | ToolUseSummaryMessage
  | ProgressMessage
  | RequestStartEvent

/**
 * Tagged union for type-narrowing on `message.type`.
 * LLMMessage uses `role` discrimination; all others use `type`.
 */
export type LoopMessageType =
  | LLMMessage['role']        // 'user' | 'assistant'
  | StreamEvent['type']       // Stream events
  | 'tombstone'               // TombstoneMessage
  | 'tool_use_summary'        // ToolUseSummaryMessage
  | 'progress'                // ProgressMessage
  | 'stream_request_start'    // RequestStartEvent

// ── Message normalization helpers (Phase A stubs) ──

/** Check if a loop message is a tombstone. */
export function isTombstoneMessage(msg: LoopMessage): msg is TombstoneMessage {
  return typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'tombstone'
}

/** Check if a loop message is a tool use summary. */
export function isToolUseSummaryMessage(msg: LoopMessage): msg is ToolUseSummaryMessage {
  return typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'tool_use_summary'
}

/** Check if a loop message is a progress update. */
export function isProgressMessage(msg: LoopMessage): msg is ProgressMessage {
  return typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'progress'
}

/** Check if a loop message is a request start event. */
export function isRequestStartEvent(msg: LoopMessage): msg is RequestStartEvent {
  return typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'stream_request_start'
}

/** Check if a loop message is a stream event. */
export function isStreamEvent(msg: LoopMessage): msg is StreamEvent {
  return typeof msg === 'object' && msg !== null && 'type' in msg && (
    msg.type === 'text_delta' ||
    msg.type === 'tool_use_start' ||
    msg.type === 'tool_use_delta' ||
    msg.type === 'tool_use_stop' ||
    msg.type === 'content_block_start' ||
    msg.type === 'content_block_delta' ||
    msg.type === 'content_block_stop' ||
    msg.type === 'message_stop' ||
    msg.type === 'stream_error' ||
    msg.type === 'stream_request_start' ||
    msg.type === 'compact_boundary'
  )
}

// ── Tool progress callback (for tool implementations) ──

/** Callback type that tool implementations call to report progress. */
export type ToolProgressCallback = (event: Omit<ProgressMessage, 'timestamp'>) => void
