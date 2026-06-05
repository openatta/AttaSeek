/**
 * MockLLMProvider — FIFO queue mock implementing the LLMProvider interface.
 *
 * Pre-program responses with pushTurn() / pushFullTurn() / pushError(),
 * then inject into AgentOrchestrator. Each chatStream() call consumes
 * the next queued turn. Records all requests for assertion.
 */

import type { LLMProvider, LLMChatParams, LLMChatResult, LLMChunk, LLMChunkCallback } from '../../../src/main/agent/llm/LLMProvider'
import { LLMError } from '../../../src/main/agent/llm/LLMProvider'

export class MockLLMProvider implements LLMProvider {
  readonly name = 'mock'
  readonly models = ['mock-model']

  private turns: { chunks: LLMChunk[]; result: LLMChatResult }[] = []
  private requests: LLMChatParams[] = []

  // ── Queue programming ──

  pushTurn(chunks: LLMChunk[], result?: LLMChatResult): void {
    this.turns.push({
      chunks,
      result: result || {
        content: [{ type: 'text', text: '' }],
        stopReason: 'end_turn',
        usage: { inputTokens: 0, outputTokens: 0 },
      },
    })
  }

  pushError(code: LLMError['code'], message: string): void {
    this.turns.push({ chunks: [], result: null as any })
    // Mark this turn as error — the next chatStream will throw
    const err = new LLMError(code, message)
    ;(this.turns[this.turns.length - 1] as any)._error = err
  }

  // ── LLMProvider implementation ──

  async chat(params: LLMChatParams): Promise<LLMChatResult> {
    this.requests.push(params)
    const turn = this.turns.shift()
    if (!turn) throw new LLMError('unknown', 'MockLLMProvider: no turns queued')
    if ((turn as any)._error) throw (turn as any)._error
    return turn.result
  }

  async chatStream(params: LLMChatParams, onChunk: LLMChunkCallback): Promise<LLMChatResult> {
    this.requests.push(params)
    const turn = this.turns.shift()
    if (!turn) throw new LLMError('unknown', 'MockLLMProvider: no turns queued')
    if ((turn as any)._error) throw (turn as any)._error

    // Simulate streaming: call onChunk for each chunk with a microtask delay
    for (const chunk of turn.chunks) {
      await new Promise(r => setImmediate(r))
      onChunk(chunk)
    }
    return turn.result
  }

  async validateKey(_apiKey: string): Promise<boolean> {
    return true
  }

  // ── Assertion helpers ──

  get requestCount(): number { return this.requests.length }

  nthRequest(n: number): LLMChatParams | undefined {
    return this.requests[n]
  }

  get lastRequest(): LLMChatParams | undefined {
    return this.requests[this.requests.length - 1]
  }
}
