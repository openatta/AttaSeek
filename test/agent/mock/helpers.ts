/**
 * Stream event builder helpers for mock LLM responses.
 *
 * Factory functions that produce correctly-typed LLMChunk and LLMChatResult
 * objects. Use these to build mock response sequences in scenario files.
 */

import type { LLMChunk, LLMChatResult, LLMContentBlock } from '../../../src/main/agent/llm/ModelProvider'

// ── Chunk builders ──

export function textDelta(text: string): LLMChunk {
  return { type: 'text_delta', text }
}

export function toolUseStart(id: string, name: string): LLMChunk {
  return { type: 'tool_use_start', id, name }
}

export function toolUseDelta(id: string, input_json: string): LLMChunk {
  return { type: 'tool_use_delta', id, input_json }
}

export function blockStop(index: number): LLMChunk {
  return { type: 'content_block_stop', index }
}

export function messageStop(): LLMChunk {
  return { type: 'message_stop' }
}

// ── Result builders ──

export function endTurnResult(text: string, tokens: { input: number; output: number } = { input: 100, output: 50 }): LLMChatResult {
  return {
    content: [{ type: 'text', text }],
    stopReason: 'end_turn',
    usage: { inputTokens: tokens.input, outputTokens: tokens.output },
  }
}

export function toolUseResult(
  toolBlocks: { id: string; name: string; input: unknown }[],
  tokens: { input: number; output: number } = { input: 200, output: 100 },
): LLMChatResult {
  const content: LLMContentBlock[] = toolBlocks.map(tb => ({
    type: 'tool_use',
    id: tb.id,
    name: tb.name,
    input: tb.input,
  }))
  return {
    content,
    stopReason: 'tool_use',
    usage: { inputTokens: tokens.input, outputTokens: tokens.output },
  }
}

// ── Turn builders ──

/** Build a single-turn text-only response */
export function textTurn(text: string): { chunks: LLMChunk[]; result: LLMChatResult } {
  return {
    chunks: [textDelta(text), messageStop()],
    result: endTurnResult(text),
  }
}

/** Build a single-turn tool_use response (one tool call) */
export function toolTurn(
  toolId: string,
  toolName: string,
  input: Record<string, unknown>,
): { chunks: LLMChunk[]; result: LLMChatResult } {
  return {
    chunks: [
      toolUseStart(toolId, toolName),
      toolUseDelta(toolId, JSON.stringify(input)),
      blockStop(1),
      messageStop(),
    ],
    result: toolUseResult([{ id: toolId, name: toolName, input }]),
  }
}
