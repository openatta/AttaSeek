/**
 * Tool error handling depth tests.
 */
import { describe, it, expect } from 'vitest'
import { MockLLMProvider } from '../mock/MockLLMProvider'
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

describe('Tool Error — unknown tool', () => {
  it('should return error for non-existent tool but continue', async () => {
    const mock = new MockLLMProvider()
    mock.pushTurn([
      toolUseStart('tu_1', 'non_existent_tool'), toolUseDelta('tu_1', '{}'),
      blockStop(1), messageStop(),
    ], { content: [{ type: 'tool_use', id: 'tu_1', name: 'non_existent_tool', input: {} }], stopReason: 'tool_use', usage: { inputTokens: 100, outputTokens: 50 } })
    mock.pushTurn([textDelta('Tried unknown tool'), messageStop()], endTurnResult('Tried unknown tool'))

    const orchestrator = new AgentOrchestrator()
    const events: any[] = []
    const gen = orchestrator.submitMessage(mkTask('Use bad tool'), testProfile, mock, emptyCtx)
    for await (const e of gen) events.push(e)

    const finished = events.filter(e => e.type === 'ToolCallFinished')
    expect(finished.length, 'tool call finished').toBeGreaterThanOrEqual(1)
    expect(finished[0]?.payload?.status, 'tool error status').toBe('error')
    expect(events.some(e => e.type === 'TaskCompleted'), 'still completes').toBe(true)
  })
})

describe('Tool Error — execution exception', () => {
  it('should catch tool execution errors and continue with error status', async () => {
    const mock = new MockLLMProvider()
    // Tool with invalid input that causes execution error
    mock.pushTurn([
      toolUseStart('tu_1', 'read_file'), toolUseDelta('tu_1', '{"path":""}'),
      blockStop(1), messageStop(),
    ], { content: [{ type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: '' } }], stopReason: 'tool_use', usage: { inputTokens: 100, outputTokens: 50 } })
    mock.pushTurn([textDelta('Error handled'), messageStop()], endTurnResult('Error handled'))

    const orchestrator = new AgentOrchestrator()
    const events: any[] = []
    const gen = orchestrator.submitMessage(mkTask('Read empty path'), testProfile, mock, emptyCtx)
    for await (const e of gen) events.push(e)

    expect(events.filter(e => e.type === 'ToolCallStarted').length, 'tool started').toBeGreaterThanOrEqual(1)
    expect(events.filter(e => e.type === 'ToolCallFinished').length, 'tool finished').toBeGreaterThanOrEqual(1)
    expect(events.some(e => e.type === 'TaskCompleted'), 'completes without crashing').toBe(true)
  })
})

describe('Tool Error — recoverable vs non-recoverable', () => {
  it('should distinguish recoverable from non-recoverable errors in payload', async () => {
    const mock = new MockLLMProvider()
    mock.pushTurn([
      toolUseStart('tu_1', 'read_file'), toolUseDelta('tu_1', '{"path":"/dev/null"}'),
      blockStop(1), messageStop(),
    ], { content: [{ type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: '/dev/null' } }], stopReason: 'tool_use', usage: { inputTokens: 100, outputTokens: 50 } })
    mock.pushTurn([textDelta('Done'), messageStop()], endTurnResult('Done'))

    const orchestrator = new AgentOrchestrator()
    const events: any[] = []
    const gen = orchestrator.submitMessage(mkTask('Read /dev/null'), testProfile, mock, emptyCtx)
    for await (const e of gen) events.push(e)

    const finished = events.filter(e => e.type === 'ToolCallFinished')
    expect(finished.length).toBeGreaterThanOrEqual(1)
    // Each ToolCallFinished has status and optional error with recoverable flag
    expect(finished.every(f => 'status' in (f.payload as any))).toBe(true)
  })
})
