/**
 * AnthropicProvider — LLMProvider implementation for Anthropic Claude API.
 *
 * Uses @anthropic-ai/sdk Messages API with streaming support.
 * Tool-use blocks are translated between our internal types and Anthropic's format.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Tool as AnthropicTool } from '@anthropic-ai/sdk/resources/messages/messages.mjs'
import type { LLMMessage, LLMContentBlock, LLMChatParams, LLMChatResult } from './LLMProvider'
import { LLMError } from './LLMProvider'
import type { LLMProvider, LLMChunkCallback } from './LLMProvider'

const DEFAULT_MAX_TOKENS = 4096

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
      const response = await this.client.messages.create(body, { signal: params.signal })
      return {
        content: response.content.map(toLLMBlock).filter((b): b is LLMContentBlock => b !== null),
        stopReason: response.stop_reason as LLMChatResult['stopReason'],
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      }
    } catch (err: unknown) {
      throw this.toLLMError(err)
    }
  }

  async chatStream(params: LLMChatParams, onChunk: LLMChunkCallback): Promise<LLMChatResult> {
    if (!this.client) throw new LLMError('auth', 'Anthropic client not initialized (no API key)')
    try {
      const body = this.buildAnthropicParams(params)
      const stream = this.client.messages.stream(body, { signal: params.signal })

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
    } catch (err: unknown) {
      throw this.toLLMError(err)
    }
  }

  private toLLMError(err: unknown): LLMError {
    const e = (err instanceof Error ? err : null) ?? (err as Record<string, unknown> | undefined)
    const status = (e as any)?.status || 0
    const errorType = (e as any)?.error?.type || ''
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
  if (isLast) (result as any).cache_control = { type: 'ephemeral' }
  return result
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
