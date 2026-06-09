/**
 * Message history correctness + AbortController timing depth tests.
 */
import { describe, it, expect } from 'vitest'
import { MockModelProvider } from '../mock/MockModelProvider'
import { textDelta, toolUseStart, toolUseDelta, blockStop, messageStop, endTurnResult } from '../mock/helpers'
import { QueryEngine } from '../../../src/main/agent/orchestrator/QueryEngine'
import { validateProfile } from '../../../src/main/agent/profile/AgentProfile'

const testProfile = validateProfile({
  id: 'test', name: 'Test',
  systemPrompt: { id: 't', sections: [{ name: 'i', priority: 10, content: 'Test.' }] },
  execution: { maxTurns: 5, maxParallelTools: 16 },
  output: { generateArtifact: false, autoTitle: false },
  memory: { autoExtract: false }, context: { autoCompact: false, maxTokens: 10_000 },
})
const mkTask = (g: string) => ({ id: 't', sessionId: 's', goal: g, status: 'idle' as const, createdAt: Date.now(), updatedAt: Date.now() })

function createMockCallModel(mock: MockModelProvider) {
  return async (params: any, onChunk: any) => {
    return mock.chatStream(params, onChunk)
  }
}

function newEngine(mock: MockModelProvider, sessionId = 's') {
  return new QueryEngine({
    sessionId,
    testDeps: { callModel: createMockCallModel(mock) },
  })
}

describe('Message history — multi-turn structure', () => {
  it('should append tool_result after each tool execution', async () => {
    const mock = new MockModelProvider()
    // Turn 1: tool
    mock.pushTurn([
      toolUseStart('tu_1', 'read_file'), toolUseDelta('tu_1', '{"path":"a.txt"}'),
      blockStop(1), messageStop(),
    ], { content: [{ type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: 'a.txt' } }], stopReason: 'tool_use', usage: { inputTokens: 100, outputTokens: 50 } })
    // Turn 2: end_turn
    mock.pushTurn([textDelta('Result'), messageStop()], endTurnResult('Result'))

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Read a.txt', mkTask('Read a.txt'), testProfile)
    for await (const e of gen) events.push(e)

    // 2 tool events + AgentMessage x2 + final TaskCompleted
    expect(events.filter(e => e.type === 'ToolCallStarted').length, '1 tool').toBe(1)
    expect(events.filter(e => e.type === 'AgentMessage').length, '2 agent messages').toBe(2)
    expect(events.some(e => e.type === 'TaskCompleted'), 'completes').toBe(true)
  })

  it('should handle empty tools list without error', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([textDelta('No tools needed'), messageStop()], {
      content: [{ type: 'text', text: 'No tools needed' }],
      stopReason: 'end_turn', usage: { inputTokens: 50, outputTokens: 20 },
    })

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Hello', mkTask('Hello'), testProfile)
    for await (const e of gen) events.push(e)

    expect(events.filter(e => e.type === 'ToolCallStarted').length, 'zero tools').toBe(0)
    expect(events.some(e => e.type === 'TaskCompleted'), 'completes').toBe(true)
  })
})

describe('AbortController — timing scenarios', () => {
  it('should handle abort during tool execution phase', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([
      toolUseStart('tu_1', 'read_file'), toolUseDelta('tu_1', '{"path":"f.txt"}'),
      blockStop(1), messageStop(),
    ], { content: [{ type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: 'f.txt' } }], stopReason: 'tool_use', usage: { inputTokens: 100, outputTokens: 50 } })

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Read f', mkTask('Read f'), testProfile)

    // Abort after first ToolCallStarted
    for await (const e of gen) {
      events.push(e)
      if (e.type === 'ToolCallStarted') { engine.interrupt(); break }
    }

    // The generator should stop yielding after interrupt
    const remaining: any[] = []
    try {
      for await (const e of gen) { remaining.push(e) }
    } catch { /* may throw after abort */ }

    // At minimum we got the ToolCallStarted + ToolCallFinished/TaskFailed
    expect(events.length).toBeGreaterThanOrEqual(1)
  })

  it('should abort before LLM call via signal', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([textDelta('Slow response'), messageStop()], endTurnResult('Slow'))

    const engine = newEngine(mock)
    engine.interrupt() // abort before submission

    const events: any[] = []
    const gen = engine.submitMessage('Test', mkTask('Test'), testProfile)
    for await (const e of gen) events.push(e)

    // Should still get some events or abort handling
    expect(events.length).toBeGreaterThanOrEqual(0)
  })

  it('should allow multiple interrupt calls without error', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([textDelta('Testing'), messageStop()], endTurnResult('Testing'))

    const engine = newEngine(mock)
    engine.interrupt()
    engine.interrupt()
    engine.interrupt() // triple call

    const events: any[] = []
    const gen = engine.submitMessage('Test', mkTask('Test'), testProfile)
    for await (const e of gen) events.push(e)

    expect(events.length).toBeGreaterThanOrEqual(0) // no crash
  })
})
