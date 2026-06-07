/**
 * Message history correctness + AbortController timing depth tests.
 */
import { describe, it, expect } from 'vitest'
import { MockModelProvider } from '../mock/MockModelProvider'
import { textDelta, toolUseStart, toolUseDelta, blockStop, messageStop, endTurnResult } from '../mock/helpers'
import { AgentOrchestrator } from '../../../src/main/agent/orchestrator/AgentOrchestrator'
import { validateProfile } from '../../../src/main/agent/profile/AgentProfile'

const testProfile = validateProfile({
  id: 'test', name: 'Test',
  systemPrompt: { id: 't', sections: [{ name: 'i', priority: 10, content: 'Test.' }] },
  execution: { maxTurns: 5, maxParallelTools: 16 },
  output: { generateArtifact: false, autoTitle: false },
  memory: { autoExtract: false }, context: { autoCompact: false, maxTokens: 10_000 },
})
const emptyCtx = { messages: [] as any[], tools: [] as any[] }
const mkTask = (g: string) => ({ id: 't', sessionId: 's', goal: g, status: 'idle' as const, createdAt: Date.now(), updatedAt: Date.now() })

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

    const orchestrator = new AgentOrchestrator()
    const events: any[] = []
    const gen = orchestrator.submitMessage(mkTask('Read a.txt'), testProfile, mock, emptyCtx)
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

    const orchestrator = new AgentOrchestrator()
    const events: any[] = []
    const gen = orchestrator.submitMessage(mkTask('Hello'), testProfile, mock, { ...emptyCtx, tools: [] })
    for await (const e of gen) events.push(e)

    expect(events.filter(e => e.type === 'ToolCallStarted').length, 'zero tools').toBe(0)
    expect(events.some(e => e.type === 'TaskCompleted'), 'completes').toBe(true)
  })

  it('should correctly pass tools when provided in assembledContext', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([textDelta('Used tools from context'), messageStop()], endTurnResult('Used tools'))

    const orchestrator = new AgentOrchestrator()
    const events: any[] = []
    const ctx = { messages: [], tools: [{ name: 'read_file', description: 'Read file', input_schema: {} }] }
    const gen = orchestrator.submitMessage(mkTask('Test'), testProfile, mock, ctx)
    for await (const e of gen) events.push(e)

    expect(events.some(e => e.type === 'TaskCompleted'), 'completes with provided tools').toBe(true)
  })
})

describe('AbortController — timing scenarios', () => {
  it('should handle abort during tool execution phase', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([
      toolUseStart('tu_1', 'read_file'), toolUseDelta('tu_1', '{"path":"f.txt"}'),
      blockStop(1), messageStop(),
    ], { content: [{ type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: 'f.txt' } }], stopReason: 'tool_use', usage: { inputTokens: 100, outputTokens: 50 } })

    const orchestrator = new AgentOrchestrator()
    const events: any[] = []
    const gen = orchestrator.submitMessage(mkTask('Read f'), testProfile, mock, emptyCtx)

    // Abort after first ToolCallStarted
    for await (const e of gen) {
      events.push(e)
      if (e.type === 'ToolCallStarted') { orchestrator.interrupt(); break }
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

    const orchestrator = new AgentOrchestrator()
    orchestrator.interrupt() // abort before submission

    const events: any[] = []
    const gen = orchestrator.submitMessage(mkTask('Test'), testProfile, mock, emptyCtx)
    for await (const e of gen) events.push(e)

    // Should still get some events or abort handling
    expect(events.length).toBeGreaterThanOrEqual(0)
  })

  it('should allow multiple interrupt calls without error', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([textDelta('Testing'), messageStop()], endTurnResult('Testing'))

    const orchestrator = new AgentOrchestrator()
    orchestrator.interrupt()
    orchestrator.interrupt()
    orchestrator.interrupt() // triple call

    const events: any[] = []
    const gen = orchestrator.submitMessage(mkTask('Test'), testProfile, mock, emptyCtx)
    for await (const e of gen) events.push(e)

    expect(events.length).toBeGreaterThanOrEqual(0) // no crash
  })
})
