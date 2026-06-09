/**
 * HookTypes — extended hook event types and hook interfaces.
 *
 * Expands from the original single PostSampling event to 8 core events,
 * matching Claude Code's hook architecture.
 */

import type { LLMMessage } from '../llm/ModelProvider'
import type { AgentTask } from '../../../shared/types/AgentTask'

// ── Hook event types ──

export type HookEventType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'Stop'
  | 'PreCompact'
  | 'PostCompact'
  | 'Notification'
  | 'PostSampling'         // legacy / compat
  | 'PermissionRequest'    // tool permission request (can override decision)
  | 'SubagentStart'        // sub-agent execution begins
  | 'SubagentStop'         // sub-agent execution completes
  | 'Elicitation'          // user question / clarification request

// ── Hook types ──

export type HookType = 'callback' | 'command' | 'prompt' | 'http'

// ── Hook matcher ──

export interface HookMatcher {
  /** Exact tool name, pipe-separated list, or regex pattern */
  pattern: string
  /** Optional condition expression (e.g., "tool_input contains 'git'") */
  if?: string
}

// ── Hook configuration ──

export interface HookConfig {
  id: string
  event: HookEventType
  type: HookType
  matcher?: HookMatcher
  command?: string
  prompt?: string
  /** URL for HTTP hook type. Must be HTTPS unless ATTA_ALLOW_HTTP_HOOKS=1. */
  url?: string
  priority: number
  enabled: boolean
  timeoutMs?: number
}

// ── Hook execution context — passed to each hook ──

export interface HookContext {
  task: AgentTask
  turnCount: number
  messages: LLMMessage[]
  lastAssistantContent: string
  profileId: string
  // Event-specific context (populated based on hook event type)
  toolCallId?: string
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
  userMessage?: string
  notificationMessage?: string
  // PermissionRequest event context
  permissionToolId?: string
  permissionToolInput?: unknown
  permissionRiskLevel?: string
  // SubagentStart/Stop event context
  subagentId?: string
  subagentProfile?: string
  subagentGoal?: string
  subagentResult?: string
  subagentStatus?: string
  // Elicitation event context
  elicitationQuestion?: string
  elicitationOptions?: string[]
  elicitationResponse?: string
}

// ── Hook execution result ──

export interface HookResult {
  /** Messages to inject into system prompt */
  messages?: string[]
  /** Block continuation (non-recoverable error) */
  preventContinuation?: boolean
  /** Reason for blocking */
  blocking?: string
  /** Whether to suppress the tool output from the LLM */
  suppressOutput?: boolean
  /** Modified tool input (PreToolUse hooks can transform input) */
  updatedInput?: unknown
  /** Hook-specific decision */
  decision?: 'approve' | 'block'
  /** PermissionRequest hooks can override the permission decision */
  permissionDecision?: 'allow' | 'deny' | 'ask'
}

// ── Re-export existing PostSamplingHook for backward compat ──

import type { PostSamplingHook } from './HookManager'
export type { PostSamplingHook }
