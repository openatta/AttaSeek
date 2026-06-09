/**
 * ModelProvider — abstract interface for language model backends.
 *
 * This is the **API communication layer** — it sends chat requests to LLM
 * backends (Anthropic, OpenAI, DeepSeek, etc.). The configuration/slot
 * resolution layer is ModelResolver.
 *
 * Concrete implementations: AnthropicProvider, OpenAICompatibleProvider.
 *
 * @remarks
 * Design doc LLM_CONFIG.md §7 uses "ModelProvider" for the config-layer
 * slot resolver. In code, that concept is `ModelResolver`; this interface
 * is the lower-level API transport.
 */

// ── Public types (shared with ContextAssembler, QueryEngine, ToolExecutor) ──

export interface LLMToolDef {
  name: string
  description: string
  input_schema: Record<string, unknown>
  /** Whether this tool is safe to run concurrently with other tools. */
  isConcurrencySafe?: boolean
  /** Max characters in tool result content before truncation. */
  maxResultSizeChars?: number
}

export interface LLMTextBlock {
  type: 'text'
  text: string
}

export interface LLMToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

export interface LLMToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
}

export type LLMContentBlock = LLMTextBlock | LLMToolUseBlock | LLMToolResultBlock

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string | LLMContentBlock[]
  /** Optional timestamp (ms) for time-based microcompact gap detection. */
  timestamp?: number
}

export interface LLMProviderConfig {
  temperature?: number
  topP?: number
  topK?: number
  maxTokens?: number
  toolChoice?: 'auto' | 'any' | 'tool' | 'none' | { type: 'tool'; name: string }
  stopSequences?: string[]
  thinkingBudget?: number
  responseFormat?: 'text' | 'json_object'
  frequencyPenalty?: number
  presencePenalty?: number
}


export interface LLMChatParams {
  systemPrompt: string
  messages: LLMMessage[]
  tools: LLMToolDef[]
  config?: LLMProviderConfig
  signal?: AbortSignal  // For cancellation mid-stream
  model?: string        // Override model for slot-based selection (falls back to provider default)
}

export interface LLMChatResult {
  content: LLMContentBlock[]
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence'
  usage: { inputTokens: number; outputTokens: number }
}

export class LLMError extends Error {
  code: 'auth' | 'rate_limit' | 'invalid_request' | 'not_found' | 'server' | 'timeout' | 'unknown'
  statusCode?: number
  constructor(code: LLMError['code'], message: string, statusCode?: number) {
    super(message)
    this.name = 'LLMError'
    this.code = code
    this.statusCode = statusCode
  }
}

export type LLMChunk =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'tool_use_delta'; id: string; input_json: string }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_stop' }

export type LLMChunkCallback = (chunk: LLMChunk) => void

// ── Provider interface ──

/** ModelProvider — interface for LLM API backends.
 *  Implementations handle the wire protocol (Anthropic Messages, OpenAI Chat Completions).
 *  For model selection, see ModelResolver. */
export interface ModelProvider {
  readonly name: string
  readonly models: string[]
  /** Non-streaming chat completion */
  chat(params: LLMChatParams): Promise<LLMChatResult>
  /** Streaming chat completion — calls onChunk per token delta */
  chatStream(params: LLMChatParams, onChunk: LLMChunkCallback): Promise<LLMChatResult>
  /** Validate an API key by making a minimal request */
  validateKey(apiKey: string): Promise<boolean>
  /** Attempt to refresh credentials (OAuth token, AWS session, GCP token).
   *  Returns true if credentials were successfully refreshed. Called before
   *  retrying on 401/403 auth errors. Providers that use static API keys
   *  can leave this unimplemented (defaults to no-op). */
  refreshCredentials?(): Promise<boolean>
  /**
   * Get a human-readable description of a specific model for system prompt injection.
   * Used by the env-info section to tell the model what it is.
   * @returns e.g. "You are powered by the model named Claude Sonnet 4.6. The exact model ID is claude-sonnet-4-6."
   */
  getModelDescription?(modelId: string): string | null
  /**
   * Get the knowledge cutoff date for a specific model, if known.
   * @returns e.g. "August 2025"
   */
  getKnowledgeCutoff?(modelId: string): string | null
}

/** Check if an error indicates expired/revoked credentials that could be refreshed. */
export function isCredentialExpiredError(err: unknown): boolean {
  const code = (err as any)?.code
  const status = (err as any)?.status ?? (err as any)?.statusCode
  // 401 = expired, 403 = revoked (OAuth), AWS/GCP auth errors
  if (status === 401 || status === 403) return true
  if (code === 'CredentialsProviderError' || code === 'invalid_grant') return true
  return false
}
