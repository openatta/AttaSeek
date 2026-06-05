/**
 * OpenAICompatibleProvider — LLMProvider over /v1/chat/completions endpoint.
 *
 * Compatible with OpenAI, DeepSeek, Qwen, Moonshot, and any service
 * that implements the /v1/chat/completions API.
 *
 * Tool calling uses the OpenAI function_call convention, mapped to LLMToolUseBlock.
 */

import type {
  LLMProvider, LLMChatParams, LLMChatResult,
  LLMContentBlock, LLMToolDef, LLMMessage,
  LLMChunkCallback,
} from './LLMProvider'
import { LLMError } from './LLMProvider'

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

export class OpenAICompatibleProvider implements LLMProvider {
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
      const body = this.buildRequestBody(params, false)
      const res = await this.fetchWithTimeout(`${this.endpointUrl}/chat/completions`, {
        method: 'POST', headers: this.headers(), body: JSON.stringify(body),
      })
      const json = await res.json() as OpenAIResponse
      if (!res.ok) throw this.toLLMError(res.status, json as OpenAIResponse)
      return this.toChatResult(json)
    } catch (err: unknown) {
      if (err instanceof LLMError) throw err
      throw new LLMError('unknown', err.message || 'Unknown error')
    }
  }

  async chatStream(params: LLMChatParams, onChunk: LLMChunkCallback): Promise<LLMChatResult> {
    try {
      const body = this.buildRequestBody(params, true)
      const res = await this.fetchWithTimeout(`${this.endpointUrl}/chat/completions`, {
        method: 'POST', headers: this.headers(), body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errText = (await res.text()).slice(0, 300)
        throw this.toLLMError(res.status, JSON.parse(errText || '{}'))
      }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const contentBlocks: LLMContentBlock[] = []
    let currentToolCalls: Map<number, { id: string; name: string; args: string }> = new Map()
    let usage = { inputTokens: 0, outputTokens: 0 }
    let stopReason: LLMChatResult['stopReason'] = 'end_turn'

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Extract complete lines without splitting entire buffer (O(n) per line, not O(n²))
      let idx: number
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 1)
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue

        try {
          const chunk = JSON.parse(data)
          const choice = chunk.choices?.[0]
          if (!choice) continue

          const delta = choice.delta

          // Text delta
          if (delta?.content) {
            onChunk({ type: 'text_delta', text: delta.content })
          }

          // Tool call delta
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index
              if (!currentToolCalls.has(idx)) {
                currentToolCalls.set(idx, { id: tc.id || '', name: '', args: '' })
                if (tc.function?.name) {
                  currentToolCalls.get(idx)!.name = tc.function.name
                  onChunk({ type: 'tool_use_start', id: tc.id || `tc_${idx}`, name: tc.function.name })
                }
              }
              const cur = currentToolCalls.get(idx)!
              if (tc.id) cur.id = tc.id
              if (tc.function?.arguments) {
                cur.args += tc.function.arguments
                onChunk({ type: 'tool_use_delta', id: cur.id, input_json: tc.function.arguments })
              }
            }
          }

          // Finish
          if (choice.finish_reason) {
            stopReason = toStopReason(choice.finish_reason)
            onChunk({ type: 'content_block_stop', index: choice.index ?? 0 })
          }

          if (chunk.usage) {
            usage = { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens }
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    onChunk({ type: 'message_stop' })

    // Build content blocks from accumulated tool calls
    for (const [, tc] of currentToolCalls) {
      if (tc.name) {
        contentBlocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tryParseJson(tc.args) || tc.args,
        })
      }
    }

    return { content: contentBlocks, stopReason, usage }
    } catch (err: unknown) {
      if (err instanceof LLMError) throw err
      if (err?.name === 'AbortError') throw new LLMError('timeout', 'Request was cancelled or timed out')
      throw new LLMError('unknown', err.message || 'Unknown error')
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
    } catch {
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
    const messages = params.messages.map((m) => toOpenAIMessage(m))
    const body: Record<string, unknown> = {
      model: this.defaultModel,
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
      body.tool_choice = cfg.toolChoice === 'none' ? 'none'
        : cfg.toolChoice === 'any' || cfg.toolChoice === 'tool' ? 'required'
        : 'auto'
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
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      return res
    } finally {
      clearTimeout(timer)
    }
  }

  private toLLMError(status: number, body: Record<string, unknown>): LLMError {
    if (status === 401 || status === 403) return new LLMError('auth', body?.error?.message || 'Authentication failed', status)
    if (status === 429) return new LLMError('rate_limit', body?.error?.message || 'Rate limited', status)
    if (status === 400) return new LLMError('invalid_request', body?.error?.message || 'Invalid request', status)
    if (status === 404) return new LLMError('not_found', body?.error?.message || 'Not found', status)
    if (status >= 500) return new LLMError('server', body?.error?.message || 'Server error', status)
    return new LLMError('unknown', body?.error?.message || `HTTP ${status}`, status)
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

function tryParseJson(s: string): unknown {
  try { return JSON.parse(s) } catch { return null }
}

function toStopReason(finishReason: string): LLMChatResult['stopReason'] {
  if (finishReason === 'tool_calls') return 'tool_use'
  if (finishReason === 'length') return 'max_tokens'
  return 'end_turn'
}
