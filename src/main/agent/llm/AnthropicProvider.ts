/**
 * AnthropicProvider — ModelProvider implementation for Anthropic Claude API.
 *
 * Uses @anthropic-ai/sdk Messages API with streaming support.
 * Tool-use blocks are translated between our internal types and Anthropic's format.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Tool as AnthropicTool } from '@anthropic-ai/sdk/resources/messages/messages.mjs'
import type { LLMMessage, LLMContentBlock, LLMChatParams, LLMChatResult } from './ModelProvider'
import { LLMError } from './ModelProvider'
import type { ModelProvider, LLMChunkCallback } from './ModelProvider'
import { withRetry, retryOnOverload, retryOnRateLimit, retryOnServerError } from './withRetry'
import { getModelFamily } from './ModelAliases'

const DEFAULT_MAX_TOKENS = 4096

/** Minimal typed interface for Anthropic SDK client methods used by this provider. */
interface AnthropicClientExt {
  messages: {
    create(params: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<{
      content: Anthropic.ContentBlock[]
      stop_reason: string
      usage: { input_tokens: number; output_tokens: number }
    }>
    stream(params: Record<string, unknown>, options?: { signal?: AbortSignal }): {
      on(event: 'text', handler: (text: string) => void): void
      on(event: 'contentBlockStart', handler: (block: { type: string; index: number; content_block: { type: string; id: string; name: string } }) => void): void
      on(event: 'contentBlockDelta', handler: (delta: { type: string; index: number; delta: { type: string; partial_json?: string } }) => void): void
      on(event: 'contentBlockStop', handler: (block: { index: number }) => void): void
      finalMessage(): Promise<{
        content: Anthropic.ContentBlock[]
        stop_reason: string
        usage: { input_tokens: number; output_tokens: number }
      }>
    }
  }
}

export class AnthropicProvider implements ModelProvider {
  readonly name = 'anthropic'
  readonly models: string[]

  private client: AnthropicClientExt | null = null
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, models: string[], baseUrl?: string) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl || 'https://api.anthropic.com'
    this.models = models
    if (apiKey) {
      this.client = new Anthropic({ apiKey, baseURL: this.baseUrl }) as unknown as AnthropicClientExt
    }
  }

  /** Update the API key and recreate the client */
  setApiKey(key: string, baseUrl?: string): void {
    this.apiKey = key
    if (baseUrl) this.baseUrl = baseUrl
    this.client = new Anthropic({ apiKey: key, baseURL: this.baseUrl }) as unknown as AnthropicClientExt
  }

  private buildAnthropicParams(params: LLMChatParams): Record<string, unknown> {
    const cfg = params.config || {}
    const model = params.model || this.models[0]
    const body: Record<string, unknown> = {
      model,
      max_tokens: cfg.maxTokens || DEFAULT_MAX_TOKENS,
      system: params.systemPrompt,
      messages: params.messages.map(toAnthropicMessage),
      tools: params.tools.length > 0 ? params.tools.map((t, i) => toAnthropicTool(t, i === params.tools.length - 1)) : undefined,
    }
    if (cfg.temperature !== undefined) body.temperature = cfg.temperature
    if (cfg.topP !== undefined) body.top_p = cfg.topP
    if (cfg.topK !== undefined) body.top_k = cfg.topK
    if (cfg.stopSequences) body.stop_sequences = cfg.stopSequences
    if (cfg.toolChoice) {
      if (typeof cfg.toolChoice === 'object') {
        body.tool_choice = { type: 'tool', name: cfg.toolChoice.name }
      } else if (cfg.toolChoice !== 'none') {
        body.tool_choice = { type: cfg.toolChoice as string }
      }
      // 'none' → omit tool_choice entirely (Anthropic default)
    }
    // Enable thinking budget for opus-family models (case-insensitive via getModelFamily)
    if (cfg.thinkingBudget && getModelFamily(model as string) === 'opus') {
      body.thinking = { type: 'enabled' as const, budget_tokens: cfg.thinkingBudget }
    }
    return body
  }

  async chat(params: LLMChatParams): Promise<LLMChatResult> {
    if (!this.client) throw new LLMError('auth', 'Anthropic client not initialized (no API key)')
    const body = this.buildAnthropicParams(params)
    try {
      return await withRetry(
        async () => {
          const response = await this.client!.messages.create(body, { signal: params.signal })
          return {
            content: response.content.map(toLLMBlock).filter((b: LLMContentBlock | null): b is LLMContentBlock => b !== null),
            stopReason: response.stop_reason as LLMChatResult['stopReason'],
            usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
          }
        },
        {
          maxRetries: 3,
          shouldRetry: (err) => retryOnOverload(err) || retryOnRateLimit(err) || retryOnServerError(err),
          onRetry: (err, attempt, delay) => {
            console.warn(`[AnthropicProvider] retry ${attempt}/3 after ${delay}ms:`, (err as Error)?.message)
          },
        },
      )
    } catch (err: unknown) {
      throw this.toLLMError(err)
    }
  }

  async chatStream(params: LLMChatParams, onChunk: LLMChunkCallback): Promise<LLMChatResult> {
    if (!this.client) throw new LLMError('auth', 'Anthropic client not initialized (no API key)')
    const body = this.buildAnthropicParams(params)
    try {
      return await withRetry(
        async () => {
          const stream = this.client!.messages.stream(body, { signal: params.signal })

          // Map content block indices to IDs for correlating tool_use_delta events
          const blockIdByIndex = new Map<number, string>()

          // Wire up Anthropic stream events to our LLMChunk format
          stream.on('text', (text: string) => {
            onChunk({ type: 'text_delta', text })
          })

          stream.on('contentBlockStart', (block: { type: string; index: number; content_block: { type: string; id: string; name: string } }) => {
            if (block.type === 'tool_use' && 'name' in block.content_block) {
              blockIdByIndex.set(block.index, block.content_block.id)
              onChunk({
                type: 'tool_use_start',
                id: block.content_block.id,
                name: block.content_block.name,
              })
            }
          })

          stream.on('contentBlockDelta', (delta: { type: string; index: number; delta: { type: string; partial_json?: string } }) => {
            if (delta.type === 'input_json_delta') {
              onChunk({
                type: 'tool_use_delta',
                id: blockIdByIndex.get(delta.index) || '',
                input_json: delta.delta.partial_json || '',
              })
            }
          })

          stream.on('contentBlockStop', (block: { index: number }) => {
            onChunk({ type: 'content_block_stop', index: block.index })
          })

          const result = await stream.finalMessage()
          onChunk({ type: 'message_stop' })
          return {
            content: result.content.map(toLLMBlock).filter((b: LLMContentBlock | null): b is LLMContentBlock => b !== null),
            stopReason: result.stop_reason as LLMChatResult['stopReason'],
            usage: { inputTokens: result.usage.input_tokens, outputTokens: result.usage.output_tokens },
          }
        },
        {
          maxRetries: 2,
          shouldRetry: (err) => retryOnOverload(err) || retryOnRateLimit(err) || retryOnServerError(err),
          onRetry: (err, attempt, delay) => {
            console.warn(`[AnthropicProvider] stream retry ${attempt}/2 after ${delay}ms:`, (err as Error)?.message)
          },
        },
      )
    } catch (err: unknown) {
      throw this.toLLMError(err)
    }
  }

  private toLLMError(err: unknown): LLMError {
    const e = (err instanceof Error ? err : null) ?? (err as Record<string, unknown> | undefined)
    const status = (e as Record<string, unknown> | undefined)?.status as number | undefined || 0
    const errorBody = (e as Record<string, unknown> | undefined)?.error
    const errorType = (errorBody && typeof errorBody === 'object' ? String((errorBody as Record<string, unknown>).type || '') : '')
    const message = e instanceof Error ? e.message : String(err ?? 'Unknown error')
    const name = e instanceof Error ? e.name : undefined
    if (status === 401 || status === 403 || errorType === 'authentication_error') return new LLMError('auth', message, status)
    if (status === 429 || errorType === 'rate_limit_error') return new LLMError('rate_limit', message, status)
    if (status === 400 || errorType === 'invalid_request_error') return new LLMError('invalid_request', message, status)
    if (status === 404 || errorType === 'not_found_error') return new LLMError('not_found', message, status)
    if (status >= 500) return new LLMError('server', message, status)
    if (name === 'AbortError' || name === 'TimeoutError') return new LLMError('timeout', message)
    return new LLMError('unknown', message)
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const temp = new Anthropic({ apiKey, baseURL: this.baseUrl })
      // Use the provider's own model for validation (works for third-party Anthropic-protocol backends)
      const validationModel = this.models[0]
      await temp.messages.create({
        model: validationModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      })
      return true
    } catch (e) {
      console.warn('[Anthropic] validateKey failed:', e instanceof Error ? e.message : String(e))
      return false
    }
  }
}

// ── Helpers: Anthropic SDK types ↔ our types ──

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

function toAnthropicTool(tool: { name: string; description: string; input_schema: Record<string, unknown> }, isLast: boolean = false): AnthropicTool {
  const result: AnthropicTool = {
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema as AnthropicTool['input_schema'],
  }
  // Mark last tool with cache_control for prompt caching
  if (isLast) (result as unknown as Record<string, unknown>).cache_control = { type: 'ephemeral' }
  return result
}

function toLLMBlock(block: Anthropic.ContentBlock): LLMContentBlock | null {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text }
    case 'tool_use':
      return { type: 'tool_use', id: block.id, name: block.name, input: block.input }
    default:
      console.warn(`[AnthropicProvider] unknown content block type: "${block.type}" — this block will be dropped. Update toLLMBlock to support new Anthropic content types.`)
      return null
  }
}
