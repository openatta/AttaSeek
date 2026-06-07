/**
 * OpenAIStreamParser — SSE (Server-Sent Events) stream parser for
 * OpenAI-compatible /v1/chat/completions streaming responses.
 *
 * Extracted from OpenAICompatibleProvider to keep file size manageable
 * and enable independent testing of the stream parser.
 */

import type { LLMChatResult, LLMContentBlock, LLMChunkCallback } from './ModelProvider'

interface StreamState {
  contentBlocks: LLMContentBlock[]
  currentToolCalls: Map<number, { id: string; name: string; args: string }>
  usage: { inputTokens: number; outputTokens: number }
  stopReason: LLMChatResult['stopReason']
  textBlockOpen: boolean
  textBlockIndex: number
}

export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: LLMChunkCallback,
): Promise<LLMChatResult> {
  const decoder = new TextDecoder()
  let buffer = ''
  const state: StreamState = {
    contentBlocks: [],
    currentToolCalls: new Map(),
    usage: { inputTokens: 0, outputTokens: 0 },
    stopReason: 'end_turn',
    textBlockOpen: false,
    textBlockIndex: 0,
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let idx: number
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 1)
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue

      try {
        processSSELine(data, state, onChunk)
      } catch (e) { console.warn('[OpenAI] malformed streaming chunk:', e instanceof Error ? e.message : String(e)) }
    }
  }

  // Build content blocks from accumulated tool calls
  for (const [, tc] of state.currentToolCalls) {
    if (tc.name) {
      state.contentBlocks.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input: tryParseJson(tc.args) || tc.args,
      })
    }
  }

  return { content: state.contentBlocks, stopReason: state.stopReason, usage: state.usage }
}

export function processSSELine(
  data: string,
  state: StreamState,
  onChunk: LLMChunkCallback,
): void {
  const chunk = JSON.parse(data)
  const choice = chunk.choices?.[0]
  if (!choice) return

  const delta = choice.delta

  // Text delta — open text block on first text, close on tool call switch
  if (delta?.content) {
    if (!state.textBlockOpen) {
      state.textBlockOpen = true
    }
    onChunk({ type: 'text_delta', text: delta.content })
  }

  // Tool call delta — close text block before starting tool calls
  if (delta?.tool_calls) {
    if (state.textBlockOpen) {
      onChunk({ type: 'content_block_stop', index: state.textBlockIndex })
      state.textBlockOpen = false
      state.textBlockIndex++
    }
    for (const tc of delta.tool_calls) {
      const tcIdx = tc.index
      if (!state.currentToolCalls.has(tcIdx)) {
        state.currentToolCalls.set(tcIdx, { id: tc.id || '', name: '', args: '' })
        if (tc.function?.name) {
          state.currentToolCalls.get(tcIdx)!.name = tc.function.name
          onChunk({ type: 'tool_use_start', id: tc.id || `tc_${tcIdx}`, name: tc.function.name })
        }
      }
      const cur = state.currentToolCalls.get(tcIdx)!
      if (tc.id) cur.id = tc.id
      if (tc.function?.arguments) {
        cur.args += tc.function.arguments
        onChunk({ type: 'tool_use_delta', id: cur.id, input_json: tc.function.arguments })
      }
    }
  }

  // Finish — close any open text block
  if (choice.finish_reason) {
    if (state.textBlockOpen) {
      onChunk({ type: 'content_block_stop', index: state.textBlockIndex })
      state.textBlockOpen = false
    }
    state.stopReason = toStopReason(choice.finish_reason)
  }

  if (chunk.usage) {
    state.usage = { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens }
  }
}

/** Safe JSON parse — returns null on failure */
export function tryParseJson(s: string): unknown {
  try { return JSON.parse(s) } catch { return null }
}

/** Map OpenAI finish_reason to our stop reason type */
export function toStopReason(finishReason: string): LLMChatResult['stopReason'] {
  if (finishReason === 'tool_calls') return 'tool_use'
  if (finishReason === 'length') return 'max_tokens'
  return 'end_turn'
}
