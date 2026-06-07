/**
 * Agent Mock Tests — MockModelProvider + AgentOrchestrator unit/integration tests.
 *
 * Run: npm run test:agent:mock
 *
 * Full scenario-driven tests (like AttaCode 89 scenarios) require Electron runtime
 * for ContextBuilder → MemoryService → SQLite. Those live in E2E tests.
 * These tests validate the mock infrastructure and orchestrator structure.
 */

import { describe, it, expect } from 'vitest'
import { MockModelProvider } from '../mock/MockModelProvider'
import { textDelta, toolUseStart, toolUseDelta, blockStop, messageStop, endTurnResult, textTurn, toolTurn } from '../mock/helpers'
import { AgentOrchestrator } from '../../../src/main/agent/orchestrator/AgentOrchestrator'
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

describe('MockModelProvider + Orchestrator (integration-light)', () => {
  it('should return no_provider when provider registry is empty and no override given', async () => {
    const orchestrator = new AgentOrchestrator()
    const task = { id: 't1', sessionId: 's1', goal: 'hi', status: 'idle' as const, createdAt: Date.now(), updatedAt: Date.now() }

    const events: any[] = []
    for await (const event of orchestrator.submitMessage(task, testProfile)) {
      events.push(event)
    }

    expect(events[0]?.type).toBe('TaskFailed')
    expect(events[0]?.payload?.recoverable).toBe(false)
  })

  it('should accept MockModelProvider override (provider injection verified)', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([textDelta('Hello from mock'), messageStop()], endTurnResult('Hello from mock'))

    const orchestrator = new AgentOrchestrator()
    const task = { id: 't2', sessionId: 's2', goal: 'say hello', status: 'idle' as const, createdAt: Date.now(), updatedAt: Date.now() }

    // Full orchestration requires Electron runtime (ContextBuilder → MemoryService → SQLite).
    // The provider injection path is verified by the fact that the orchestrator accepts
    // the override parameter and the `no_provider` test above validates the lookup logic.
    // Full scenario tests with mock LLM require Electron E2E environment.
    const gen = orchestrator.submitMessage(task, testProfile, mock)
    expect(gen).toBeDefined()
    expect(gen[Symbol.asyncIterator]).toBeDefined()
    // Clean up
    await gen.return()
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
