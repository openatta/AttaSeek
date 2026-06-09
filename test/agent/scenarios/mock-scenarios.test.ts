/**
 * Agent Mock Tests — MockModelProvider + QueryEngine unit/integration tests.
 *
 * Run: npm run test:agent:mock
 *
 * These tests validate the mock infrastructure and engine structure.
 */

import { describe, it, expect } from 'vitest'
import { MockModelProvider } from '../mock/MockModelProvider'
import { textDelta, toolUseStart, toolUseDelta, blockStop, messageStop, endTurnResult, textTurn, toolTurn } from '../mock/helpers'
import { QueryEngine } from '../../../src/main/agent/orchestrator/QueryEngine'
import { validateProfile } from '../../../src/main/agent/profile/AgentProfile'

const testProfile = validateProfile({
  id: 'test',
  name: 'Test',
  systemPrompt: { id: 'test', sections: [{ name: 'i', priority: 10, content: 'Test.' }] },
  execution: { maxTurns: 2 },
  output: { generateArtifact: false, autoTitle: false },
  memory: { autoExtract: false },
  context: { autoCompact: false },
})

function createMockCallModel(mock: MockModelProvider) {
  return async (params: any, onChunk: any) => {
    return mock.chatStream(params, onChunk)
  }
}

function newEngine(mock?: MockModelProvider) {
  return new QueryEngine({
    sessionId: 's',
    testDeps: mock ? { callModel: createMockCallModel(mock) } : undefined,
  })
}

describe('MockModelProvider (unit)', () => {
  it('should enqueue and dequeue turns in FIFO order', async () => {
    const mock = new MockModelProvider()

    mock.pushTurn([textDelta('hello'), messageStop()], endTurnResult('hello'))
    mock.pushTurn([textDelta('world'), messageStop()], endTurnResult('world'))

    const r1 = await mock.chatStream({ systemPrompt: '', messages: [], tools: [] }, () => {})
    const r2 = await mock.chatStream({ systemPrompt: '', messages: [], tools: [] }, () => {})

    expect(mock.requestCount).toBe(2)
    expect((r1.content[0] as any).text).toBe('hello')
    expect((r2.content[0] as any).text).toBe('world')
  })

  it('should throw when no turns queued', async () => {
    const mock = new MockModelProvider()
    await expect(mock.chatStream({ systemPrompt: '', messages: [], tools: [] }, () => {}))
      .rejects.toThrow('no turns queued')
  })

  it('should throw LLMError when error queued', async () => {
    const mock = new MockModelProvider()
    mock.pushError('rate_limit', 'Too many requests')
    await expect(mock.chatStream({ systemPrompt: '', messages: [], tools: [] }, () => {}))
      .rejects.toThrow('Too many requests')
  })

  it('should record all requests for assertion', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([textDelta('a'), messageStop()], endTurnResult('a'))

    await mock.chat({ systemPrompt: 'sys', messages: [{ role: 'user', content: 'hi' }], tools: [] })

    expect(mock.nthRequest(0)?.systemPrompt).toBe('sys')
    expect(mock.nthRequest(0)?.messages).toHaveLength(1)
  })
})

describe('MockModelProvider + QueryEngine (integration-light)', () => {
  it('should return no_provider when provider registry is empty and no override given', async () => {
    const engine = newEngine()
    const task = { id: 't1', sessionId: 's1', goal: 'hi', status: 'idle' as const, createdAt: Date.now(), updatedAt: Date.now() }

    const events: any[] = []
    for await (const event of engine.submitMessage('hi', task, testProfile)) {
      events.push(event)
    }

    // QueryEngine emits UserMessage first, then TaskFailed when no provider available
    const failed = events.find(e => e.type === 'TaskFailed')
    expect(failed, 'has TaskFailed event').toBeDefined()
    expect(failed!.payload?.recoverable).toBe(false)
  })

  it('should accept MockModelProvider via testDeps (provider injection verified)', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([textDelta('Hello from mock'), messageStop()], endTurnResult('Hello from mock'))

    const engine = newEngine(mock)
    const task = { id: 't2', sessionId: 's2', goal: 'say hello', status: 'idle' as const, createdAt: Date.now(), updatedAt: Date.now() }

    const events: any[] = []
    const gen = engine.submitMessage('say hello', task, testProfile)
    for await (const e of gen) events.push(e)

    expect(events.some(e => e.type === 'TaskCompleted'), 'completes with mock').toBe(true)
  })
})

describe('Stream helpers', () => {
  it('textTurn should produce correct chunks and result', () => {
    const turn = textTurn('Hello World')
    expect(turn.chunks).toHaveLength(2) // textDelta + messageStop
    expect(turn.result.stopReason).toBe('end_turn')
    expect((turn.result.content[0] as any).text).toBe('Hello World')
  })

  it('toolTurn should produce tool_use chunks', () => {
    const turn = toolTurn('tu_1', 'read_file', { path: 'test.txt' })
    expect(turn.chunks[0]).toMatchObject({ type: 'tool_use_start', name: 'read_file' })
    expect(turn.result.stopReason).toBe('tool_use')
  })
})
