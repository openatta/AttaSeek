/**
 * LLMProvider — abstract interface for language model backends.
 *
 * MVP: AnthropicProvider via @anthropic-ai/sdk Messages API.
 * Future: OpenAI, local models, or plugin-provided backends.
 *
 * API keys are stored via Electron safeStorage (main/store/secrets.ts)
 * and never exposed to the renderer process.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Tool as AnthropicTool } from '@anthropic-ai/sdk/resources/messages/messages.mjs'

// ── Public types (shared with ContextBuilder, AgentLoop, ToolExecutor) ──

export interface LLMToolDef {
  name: string
  description: string
  input_schema: Record<string, unknown>
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
}

export interface LLMProviderConfig {
  temperature?: number
  topP?: number
  topK?: number
  maxTokens?: number
  toolChoice?: 'auto' | 'any' | 'tool' | 'none'
  stopSequences?: string[]
  thinkingBudget?: number
  responseFormat?: 'text' | 'json_object'
  frequencyPenalty?: number
  presencePenalty?: number
}

export function extractProviderConfig(extraParams?: Record<string, unknown>): LLMProviderConfig {
  if (!extraParams) return {}
  const allowed = ['temperature','topP','topK','maxTokens','toolChoice','stopSequences','thinkingBudget','responseFormat','frequencyPenalty','presencePenalty']
  const cfg: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in extraParams) cfg[key] = extraParams[key]
  }
  return cfg as LLMProviderConfig
}

export interface LLMChatParams {
  systemPrompt: string
  messages: LLMMessage[]
  tools: LLMToolDef[]
  config?: LLMProviderConfig
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

export interface LLMProvider {
  readonly name: string
  readonly models: string[]
  /** Non-streaming chat completion */
  chat(params: LLMChatParams): Promise<LLMChatResult>
  /** Streaming chat completion — calls onChunk per token delta */
  chatStream(params: LLMChatParams, onChunk: LLMChunkCallback): Promise<LLMChatResult>
  /** Validate an API key by making a minimal request */
  validateKey(apiKey: string): Promise<boolean>
}

// ── Anthropic Provider ──

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic'
  readonly models: string[]

  private client: Anthropic | null = null
  private apiKey: string

  constructor(apiKey: string, models?: string[]) {
    this.apiKey = apiKey
    this.models = models || [
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
      'claude-opus-4-8',
    ]
    if (apiKey) {
      this.client = new Anthropic({ apiKey })
    }
  }

  /** Update the API key and recreate the client */
  setApiKey(key: string): void {
    this.apiKey = key
    this.client = new Anthropic({ apiKey: key })
  }

  private buildAnthropicParams(params: LLMChatParams) {
    const cfg = params.config || {}
    const body: Record<string, unknown> = {
      model: this.models[0],
      max_tokens: cfg.maxTokens || 4096,
      system: params.systemPrompt,
      messages: params.messages.map(toAnthropicMessage),
      tools: params.tools.length > 0 ? params.tools.map(toAnthropicTool) : undefined,
    }
    if (cfg.temperature !== undefined) body.temperature = cfg.temperature
    if (cfg.topP !== undefined) body.top_p = cfg.topP
    if (cfg.topK !== undefined) body.top_k = cfg.topK
    if (cfg.stopSequences) body.stop_sequences = cfg.stopSequences
    if (cfg.toolChoice) {
      body.tool_choice = cfg.toolChoice === 'none' ? undefined
        : { type: cfg.toolChoice as string }
    }
    if (cfg.thinkingBudget && body.model?.toString().includes('opus')) {
      body.thinking = { type: 'enabled' as const, budget_tokens: cfg.thinkingBudget }
    }
    return body as Anthropic.MessageCreateParams
  }

  async chat(params: LLMChatParams): Promise<LLMChatResult> {
    if (!this.client) throw new LLMError('auth', 'Anthropic client not initialized (no API key)')
    try {
      const body = this.buildAnthropicParams(params)
      const response = await this.client.messages.create(body)
      return {
        content: response.content.map(toLLMBlock).filter((b): b is LLMContentBlock => b !== null),
        stopReason: response.stop_reason as LLMChatResult['stopReason'],
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      }
    } catch (err: any) {
      throw this.toLLMError(err)
    }
  }

  async chatStream(params: LLMChatParams, onChunk: LLMChunkCallback): Promise<LLMChatResult> {
    if (!this.client) throw new LLMError('auth', 'Anthropic client not initialized (no API key)')
    try {
      const body = this.buildAnthropicParams(params)
      const stream = this.client.messages.stream(body)

    // Wire up Anthropic stream events to our LLMChunk format
    stream.on('text', (text) => {
      onChunk({ type: 'text_delta', text })
    })

    stream.on('contentBlockStart', (block) => {
      if (block.type === 'tool_use' && 'name' in block.content_block) {
        onChunk({
          type: 'tool_use_start',
          id: block.content_block.id,
          name: block.content_block.name,
        })
      }
    })

    stream.on('contentBlockDelta', (delta) => {
      if (delta.type === 'input_json_delta') {
        onChunk({
          type: 'tool_use_delta',
          id: 'index' in delta ? '' : '',
          input_json: delta.delta,
        })
      }
    })

    stream.on('contentBlockStop', (block) => {
      onChunk({ type: 'content_block_stop', index: block.index })
    })

    const result = await stream.finalMessage()
    onChunk({ type: 'message_stop' })
    return {
      content: result.content.map(toLLMBlock).filter((b): b is LLMContentBlock => b !== null),
      stopReason: result.stop_reason as LLMChatResult['stopReason'],
      usage: { inputTokens: result.usage.input_tokens, outputTokens: result.usage.output_tokens },
    }
    } catch (err: any) {
      throw this.toLLMError(err)
    }
  }

  private toLLMError(err: any): LLMError {
    const status = err?.status || 0
    const type = err?.error?.type || ''
    if (status === 401 || status === 403 || type === 'authentication_error') return new LLMError('auth', err.message, status)
    if (status === 429 || type === 'rate_limit_error') return new LLMError('rate_limit', err.message, status)
    if (status === 400 || type === 'invalid_request_error') return new LLMError('invalid_request', err.message, status)
    if (status === 404 || type === 'not_found_error') return new LLMError('not_found', err.message, status)
    if (status >= 500) return new LLMError('server', err.message, status)
    if (err?.name === 'AbortError' || err?.name === 'TimeoutError') return new LLMError('timeout', err.message)
    return new LLMError('unknown', err.message || 'Unknown error')
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const temp = new Anthropic({ apiKey })
      await temp.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      })
      return true
    } catch {
      return false
    }
  }
}

// ── Provider info (metadata exposed to renderer) ──

export interface ProviderInfo {
  id: string
  name: string
  interfaceType: 'openai_compatible' | 'anthropic'
  models: string[]
  isDefault: boolean
}

// ── Provider Registry ──

export class LLMProviderRegistry {
  private providers = new Map<string, LLMProvider>()
  private infos = new Map<string, ProviderInfo>()
  private defaultId: string | null = null

  /** Register a provider by config ID */
  registerById(id: string, provider: LLMProvider, info: Omit<ProviderInfo, 'id' | 'isDefault'>): void {
    this.providers.set(id, provider)
    this.infos.set(id, { ...info, id, isDefault: false })
    if (!this.defaultId) {
      this.defaultId = id
      this.infos.get(id)!.isDefault = true
    }
  }

  /** Get a provider by config ID */
  getById(id: string): LLMProvider | undefined {
    return this.providers.get(id)
  }

  /** Get the default provider */
  getDefault(): LLMProvider | undefined {
    return this.defaultId ? this.providers.get(this.defaultId) : undefined
  }

  /** Get default provider ID */
  getDefaultId(): string | null {
    return this.defaultId
  }

  /** Set a provider as default */
  setDefault(id: string): boolean {
    if (!this.providers.has(id)) return false
    // Clear old default
    if (this.defaultId) {
      const old = this.infos.get(this.defaultId)
      if (old) old.isDefault = false
    }
    this.defaultId = id
    const info = this.infos.get(id)
    if (info) info.isDefault = true
    return true
  }

  /** Unregister a provider */
  unregister(id: string): boolean {
    const deleted = this.providers.delete(id)
    this.infos.delete(id)
    if (this.defaultId === id) {
      // Auto-promote next provider
      const next = this.providers.keys().next().value
      this.defaultId = next || null
      if (this.defaultId) {
        const info = this.infos.get(this.defaultId)
        if (info) info.isDefault = true
      }
    }
    return deleted
  }

  /** List all provider metadata */
  listProviders(): ProviderInfo[] {
    return Array.from(this.infos.values())
  }

  /** Check if any provider is configured */
  get hasProviders(): boolean {
    return this.providers.size > 0
  }
}

/** Singleton */
export const llmProviderRegistry = new LLMProviderRegistry()

// ── Helpers: Anthropic SDK types → our types ──

function toAnthropicMessage(msg: LLMMessage): Anthropic.MessageParam {
  if (typeof msg.content === 'string') {
    return { role: msg.role, content: msg.content }
  }
  return {
    role: msg.role,
    content: msg.content.map((block) => {
      switch (block.type) {
        case 'text':
          return { type: 'text', text: block.text }
        case 'tool_use':
          return { type: 'tool_use', id: block.id, name: block.name, input: block.input as Record<string, unknown> }
        case 'tool_result':
          return { type: 'tool_result', tool_use_id: block.tool_use_id, content: block.content }
      }
    }),
  } as Anthropic.MessageParam
}

function toAnthropicTool(tool: LLMToolDef): AnthropicTool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema as AnthropicTool['input_schema'],
  }
}

function toLLMBlock(block: Anthropic.ContentBlock): LLMContentBlock | null {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text }
    case 'tool_use':
      return { type: 'tool_use', id: block.id, name: block.name, input: block.input }
    default:
      return null
  }
}
