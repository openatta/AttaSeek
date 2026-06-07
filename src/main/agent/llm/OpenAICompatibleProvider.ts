/**
 * OpenAICompatibleProvider — ModelProvider over /v1/chat/completions endpoint.
 *
 * Compatible with OpenAI, DeepSeek, Qwen, Moonshot, and any service
 * that implements the /v1/chat/completions API.
 *
 * Tool calling uses the OpenAI function_call convention, mapped to LLMToolUseBlock.
 */

import type {
  ModelProvider, LLMChatParams, LLMChatResult,
  LLMContentBlock, LLMToolDef, LLMMessage,
  LLMChunkCallback,
} from './ModelProvider'
import { LLMError } from './ModelProvider'
import { withRetry, retryOnRateLimit, retryOnServerError } from './withRetry'
import { parseSSEStream, tryParseJson, toStopReason } from './OpenAIStreamParser'

interface OpenAIMessage {
  role: string
  content: string | null
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
  tool_call_id?: string
}

interface OpenAIChoice {
  message: { role: string; content: string | null; tool_calls?: OpenAIMessage['tool_calls'] }
  finish_reason: string
}

interface OpenAIResponse {
  choices: OpenAIChoice[]
  usage: { prompt_tokens: number; completion_tokens: number }
}

export class OpenAICompatibleProvider implements ModelProvider {
  readonly name = 'openai_compatible'
  readonly models: string[]

  private endpointUrl: string
  private apiKey: string
  private defaultModel: string
  private extraParams: Record<string, unknown>

  constructor(endpointUrl: string, apiKey: string, defaultModel: string, extraParams?: Record<string, unknown>) {
    this.endpointUrl = endpointUrl.replace(/\/+$/, '')
    this.apiKey = apiKey
    this.defaultModel = defaultModel
    this.extraParams = extraParams || {}
    this.models = [defaultModel]
  }

  async chat(params: LLMChatParams): Promise<LLMChatResult> {
    try {
      return await withRetry(
        async () => {
          const body = this.buildRequestBody(params, false)
          const res = await this.fetchWithTimeout(`${this.endpointUrl}/chat/completions`, {
            method: 'POST', headers: this.headers(), body: JSON.stringify(body),
          })
          const json = await res.json() as OpenAIResponse
          if (!res.ok) throw this.toLLMError(res.status, json as unknown as Record<string, unknown>)
          return this.toChatResult(json)
        },
        {
          maxRetries: 3,
          shouldRetry: (err) => retryOnRateLimit(err) || retryOnServerError(err),
          onRetry: (err, attempt, delay) => {
            console.warn(`[OpenAIProvider] retry ${attempt}/3 after ${delay}ms:`, (err as Error)?.message)
          },
        },
      )
    } catch (err: unknown) {
      if (err instanceof LLMError) throw err
      throw new LLMError('unknown', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  async chatStream(params: LLMChatParams, onChunk: LLMChunkCallback): Promise<LLMChatResult> {
    try {
      return await withRetry(
        async () => {
          const body = this.buildRequestBody(params, true)
          const res = await this.fetchWithTimeout(`${this.endpointUrl}/chat/completions`, {
            method: 'POST', headers: this.headers(), body: JSON.stringify(body),
          })
          if (!res.ok) {
            const errText = (await res.text()).slice(0, 300)
            throw this.toLLMError(res.status, JSON.parse(errText || '{}'))
          }

          const result = await parseSSEStream(res.body!.getReader(), onChunk)
          onChunk({ type: 'message_stop' })
          return result
        },
        {
          maxRetries: 2,
          shouldRetry: (err) => retryOnRateLimit(err) || retryOnServerError(err),
          onRetry: (err, attempt, delay) => {
            console.warn(`[OpenAIProvider] stream retry ${attempt}/2 after ${delay}ms:`, (err as Error)?.message)
          },
        },
      )
    } catch (err: unknown) {
      if (err instanceof LLMError) throw err
      const e = err as Error | undefined
      if (e?.name === 'AbortError') throw new LLMError('timeout', 'Request was cancelled or timed out')
      throw new LLMError('unknown', e?.message || 'Unknown error')
    }
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout(`${this.endpointUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(10000),
      })
      return res.ok
    } catch (e) {
      console.warn('[OpenAI] validateKey failed:', e instanceof Error ? e.message : String(e))
      return false
    }
  }

  // ── Helpers ──

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    }
  }

  private buildRequestBody(params: LLMChatParams, stream: boolean) {
    const cfg = params.config || {}
    const messages: OpenAIMessage[] = []

    // Insert system prompt as first message (OpenAI format: role='system')
    if (params.systemPrompt) {
      messages.push({ role: 'system', content: params.systemPrompt })
    }

    messages.push(...params.messages.map((m) => toOpenAIMessage(m)))

    const body: Record<string, unknown> = {
      model: params.model || this.defaultModel,
      messages,
      max_tokens: cfg.maxTokens || 4096,
      stream,
    }
    if (cfg.temperature !== undefined) body.temperature = cfg.temperature
    if (cfg.topP !== undefined) body.top_p = cfg.topP
    if (cfg.frequencyPenalty !== undefined) body.frequency_penalty = cfg.frequencyPenalty
    if (cfg.presencePenalty !== undefined) body.presence_penalty = cfg.presencePenalty
    if (cfg.stopSequences) body.stop = cfg.stopSequences
    if (cfg.responseFormat === 'json_object') body.response_format = { type: 'json_object' }
    if (cfg.toolChoice) {
      if (typeof cfg.toolChoice === 'object') {
        body.tool_choice = { type: 'function', function: { name: cfg.toolChoice.name } }
      } else if (cfg.toolChoice === 'none') {
        body.tool_choice = 'none'
      } else if (cfg.toolChoice === 'any' || cfg.toolChoice === 'tool') {
        body.tool_choice = 'required'
      } else {
        body.tool_choice = 'auto'
      }
    }
    // Safe extraParams: exclude internal keys to prevent overwrite
    const internalKeys = ['model', 'messages', 'tools', 'stream', 'max_tokens']
    for (const [k, v] of Object.entries(this.extraParams)) {
      if (!internalKeys.includes(k) && !(k in body)) body[k] = v
    }
    if (params.tools.length > 0) {
      body.tools = params.tools.map(toOpenAITool)
    }
    return body
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    // Combine timeout + external signal so both can abort the request
    const timeoutController = new AbortController()
    const timer = setTimeout(() => timeoutController.abort(), 30000)

    // Merge external signal if present
    const externalSignal = init.signal
    const signal = externalSignal
      ? AbortSignal.any([timeoutController.signal, externalSignal])
      : timeoutController.signal

    try {
      const { signal: _, ...restInit } = init
      const res = await fetch(url, { ...restInit, signal })
      return res
    } finally {
      clearTimeout(timer)
    }
  }

  private toLLMError(status: number, body: Record<string, unknown>): LLMError {
    const errObj = (body.error as Record<string, unknown> | undefined)
    const msg = typeof errObj?.message === 'string' ? errObj.message : undefined
    if (status === 401 || status === 403) return new LLMError('auth', msg || 'Authentication failed', status)
    if (status === 429) return new LLMError('rate_limit', msg || 'Rate limited', status)
    if (status === 400) return new LLMError('invalid_request', msg || 'Invalid request', status)
    if (status === 404) return new LLMError('not_found', msg || 'Not found', status)
    if (status >= 500) return new LLMError('server', msg || 'Server error', status)
    return new LLMError('unknown', msg || `HTTP ${status}`, status)
  }

  private toChatResult(json: OpenAIResponse): LLMChatResult {
    const choice = json.choices[0]
    const blocks: LLMContentBlock[] = []
    if (choice.message.content) {
      blocks.push({ type: 'text', text: choice.message.content })
    }
    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: tryParseJson(tc.function.arguments) || tc.function.arguments,
        })
      }
    }
    return {
      content: blocks,
      stopReason: toStopReason(choice.finish_reason),
      usage: {
        inputTokens: json.usage.prompt_tokens,
        outputTokens: json.usage.completion_tokens,
      },
    }
  }
}

// ── Tool mapping helpers ──

function toOpenAIMessage(msg: LLMMessage): OpenAIMessage {
  if (typeof msg.content === 'string') {
    return { role: msg.role, content: msg.content }
  }
  const openai: OpenAIMessage = { role: msg.role === 'assistant' ? 'assistant' : 'user', content: null }
  openai.tool_calls = []
  for (const block of msg.content) {
    switch (block.type) {
      case 'text':
        openai.content = (openai.content || '') + block.text
        break
      case 'tool_use':
        openai.tool_calls!.push({
          id: block.id,
          type: 'function',
          function: { name: block.name, arguments: JSON.stringify(block.input) },
        })
        break
      case 'tool_result':
        openai.role = 'tool'
        openai.content = block.content
        openai.tool_call_id = block.tool_use_id
        break
    }
  }
  if (openai.tool_calls!.length === 0) delete openai.tool_calls
  return openai
}

function toOpenAITool(tool: LLMToolDef) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }
}


