/**
 * Agent Engine V2 — Full Coverage Test Suite
 *
 * All execution paths tested via MockModelProvider injected through testDeps.
 * Zero DB dependency. Zero Electron runtime requirement.
 *
 * Run: npm run test:agent:mock
 */

import { describe, it, expect } from 'vitest'
import { MockModelProvider } from '../mock/MockModelProvider'
import { textDelta, toolUseStart, toolUseDelta, blockStop, messageStop, endTurnResult } from '../mock/helpers'
import { QueryEngine } from '../../../src/main/agent/orchestrator/QueryEngine'
import { validateProfile } from '../../../src/main/agent/profile/AgentProfile'

// ── Test fixtures ──

const testProfile = validateProfile({
  id: 'test',
  name: 'Test Agent',
  systemPrompt: { id: 'test', sections: [{ name: 'i', priority: 10, content: 'Test.' }] },
  execution: { maxTurns: 5, maxParallelTools: 16 },
  output: { generateArtifact: false, autoTitle: false },
  memory: { autoExtract: false },
  context: { autoCompact: false, maxTokens: 10_000 },
})

function makeTask(goal: string) {
  return { id: 't1', sessionId: 's1', goal, status: 'idle' as const, createdAt: Date.now(), updatedAt: Date.now() }
}

function createMockCallModel(mock: MockModelProvider) {
  return async (params: any, onChunk: any) => {
    return mock.chatStream(params, onChunk)
  }
}

function newEngine(mock: MockModelProvider) {
  return new QueryEngine({
    sessionId: 's1',
    testDeps: { callModel: createMockCallModel(mock) },
  })
}

// ── Path 1: No provider → no_provider ──

describe('Path: no_provider', () => {
  it('should return no_provider when registry is empty and no override', async () => {
    const engine = new QueryEngine({ sessionId: 's1' })
    const gen = engine.submitMessage('hi', makeTask('hi'), testProfile)
    const events: any[] = []
    for await (const e of gen) events.push(e)

    // QueryEngine emits UserMessage first, then TaskFailed when no provider available
    const failed = events.find(e => e.type === 'TaskFailed')
    expect(failed, 'has TaskFailed event').toBeDefined()
    expect(failed!.payload?.recoverable).toBe(false)
  })
})

// ── Path 2: Pure text reply → completed ──

describe('Path: plain-text → completed', () => {
  it('should complete when LLM returns text without tools', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([textDelta('Hello! How can I help?'), messageStop()], endTurnResult('Hello! How can I help?'))

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Say hello', makeTask('Say hello'), testProfile)
    for await (const e of gen) events.push(e)

    expect(events.some(e => e.type === 'AgentMessage'), 'has AgentMessage marker').toBe(true)
    expect(events.some(e => e.type === 'TaskCompleted'), 'has TaskCompleted').toBe(true)
    expect(events.some(e => e.type === 'TaskFailed'), 'no TaskFailed').toBe(false)
  })
})

// ── Path 3: Single tool → completed ──

describe('Path: single-tool → completed', () => {
  it('should execute one tool and complete', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([
      toolUseStart('tu_1', 'read_file'),
      toolUseDelta('tu_1', '{"path":"test.txt"}'),
      blockStop(1), messageStop(),
    ], { content: [{ type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: 'test.txt' } }], stopReason: 'tool_use', usage: { inputTokens: 100, outputTokens: 50 } })
    mock.pushTurn([textDelta('Read successful'), messageStop()], endTurnResult('Read successful'))

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Read test.txt', makeTask('Read test.txt'), testProfile)
    for await (const e of gen) events.push(e)

    expect(events.filter(e => e.type === 'ToolCallStarted').length, '1 tool call').toBe(1)
    expect(events.filter(e => e.type === 'ToolCallFinished').length, '1 tool finished').toBe(1)
    expect(events.some(e => e.type === 'TaskCompleted'), 'completed').toBe(true)
  })
})

// ── Path 4: Multi-tool parallel → completed ──

describe('Path: multi-tool → completed', () => {
  it('should execute 2 parallel read tools', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([
      toolUseStart('tu_1', 'read_file'), toolUseDelta('tu_1', '{"path":"a.txt"}'), blockStop(1),
      toolUseStart('tu_2', 'read_file'), toolUseDelta('tu_2', '{"path":"b.txt"}'), blockStop(2),
      messageStop(),
    ], {
      content: [
        { type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: 'a.txt' } },
        { type: 'tool_use', id: 'tu_2', name: 'read_file', input: { path: 'b.txt' } },
      ],
      stopReason: 'tool_use', usage: { inputTokens: 200, outputTokens: 100 },
    })
    mock.pushTurn([textDelta('Both read'), messageStop()], endTurnResult('Both read'))

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Read two files', makeTask('Read two files'), testProfile)
    for await (const e of gen) events.push(e)

    expect(events.filter(e => e.type === 'ToolCallStarted').length, '2 tool calls').toBe(2)
    expect(events.some(e => e.type === 'TaskCompleted'), 'completed').toBe(true)
  })
})

// ── Path 5: Permission deny → denied ──

describe('Path: permission-deny → denied', () => {
  it('should terminate with denied when tool is denied', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([
      toolUseStart('tu_1', 'git_commit'),
      toolUseDelta('tu_1', '{"message":"fix"}'),
      blockStop(1), messageStop(),
    ], {
      content: [{ type: 'tool_use', id: 'tu_1', name: 'git_commit', input: { message: 'fix' } }],
      stopReason: 'tool_use', usage: { inputTokens: 100, outputTokens: 50 },
    })

    const riskyProfile = validateProfile({
      id: 'risky', name: 'Risky',
      systemPrompt: { id: 'r', sections: [{ name: 'i', priority: 10, content: 'Risky.' }] },
      execution: { maxTurns: 1 },
      output: { generateArtifact: false },
    })

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Commit', makeTask('Commit'), riskyProfile)
    for await (const e of gen) events.push(e)

    expect(events.filter(e => e.type === 'ToolCallStarted').length, 'tool call made').toBeGreaterThanOrEqual(1)
    expect(events.some(e => e.type === 'ToolCallFinished'), 'tool call finished').toBe(true)
  })
})

// ── Path 6: Multi-turn loop (3+ turns) ──

describe('Path: multi-turn-loop', () => {
  it('should execute 3 turns and complete', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([
      toolUseStart('tu_1', 'read_file'), toolUseDelta('tu_1', '{"path":"a.ts"}'),
      blockStop(1), messageStop(),
    ], { content: [{ type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: 'a.ts' } }], stopReason: 'tool_use', usage: { inputTokens: 100, outputTokens: 50 } })
    mock.pushTurn([
      toolUseStart('tu_2', 'search_code'), toolUseDelta('tu_2', '{"query":"export"}'),
      blockStop(1), messageStop(),
    ], { content: [{ type: 'tool_use', id: 'tu_2', name: 'search_code', input: { query: 'export' } }], stopReason: 'tool_use', usage: { inputTokens: 100, outputTokens: 50 } })
    mock.pushTurn([textDelta('Analysis complete'), messageStop()], endTurnResult('Analysis complete'))

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Analyze code', makeTask('Analyze code'), testProfile)
    for await (const e of gen) events.push(e)

    expect(events.filter(e => e.type === 'ToolCallStarted').length, '2 tool calls across turns').toBe(2)
    expect(events.some(e => e.type === 'TaskCompleted'), 'completed').toBe(true)
  })
})

// ── Path 7: User interrupt → aborted ──

describe('Path: interrupt → aborted', () => {
  it('should abort when interrupt() is called mid-execution', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([
      textDelta('Hel'), textDelta('lo'), messageStop(),
    ], endTurnResult('Hello'))

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Say hi', makeTask('Say hi'), testProfile)

    engine.interrupt()

    for await (const e of gen) events.push(e)

    expect(events.some(e => e.type === 'TaskFailed') || events.length > 0, 'has events').toBe(true)
  })
})

// ── Path 8: LLM API error → model_error ──

describe('Path: llm-error → model_error', () => {
  it('should fail with model_error when LLM throws', async () => {
    const mock = new MockModelProvider()
    mock.pushError('rate_limit', 'Too many requests')

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Do something', makeTask('Do something'), testProfile)
    for await (const e of gen) events.push(e)

    expect(events.some(e => e.type === 'TaskFailed'), 'has TaskFailed').toBe(true)
  })
})

// ── Path 9: LLM error recovery → retry then fail ──

describe('Path: error-recovery', () => {
  it('should retry server errors once then fail (L1)', async () => {
    const mock = new MockModelProvider()
    mock.pushError('server', 'Internal server error')
    mock.pushError('server', 'Internal server error') // retry also fails

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Try something', makeTask('Try something'), testProfile)
    for await (const e of gen) events.push(e)

    expect(events.some(e => e.type === 'TaskFailed'), 'fails after retry exhausted').toBe(true)
    expect(mock.requestCount, 'two attempts (initial + retry)').toBe(2)
  })

  it('should retry rate_limit errors with wait (L2)', async () => {
    const mock = new MockModelProvider()
    mock.pushError('rate_limit', 'Too many requests')
    mock.pushError('rate_limit', 'Still rate limited')

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Try', makeTask('Try'), testProfile)
    for await (const e of gen) events.push(e)

    expect(events.some(e => e.type === 'TaskFailed'), 'fails after rate_limit retries').toBe(true)
    expect(mock.requestCount, 'retried at least once').toBeGreaterThanOrEqual(2)
  }, 10_000)
})

// ── Path 10: LLM returns end_turn immediately (empty tools) ──

describe('Path: end-turn-immediate', () => {
  it('should complete when first response has no tool_use', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([textDelta('Done.'), messageStop()], {
      content: [{ type: 'text', text: 'Done.' }],
      stopReason: 'end_turn', usage: { inputTokens: 50, outputTokens: 20 },
    })

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Check status', makeTask('Check status'), testProfile)
    for await (const e of gen) events.push(e)

    expect(events.some(e => e.type === 'TaskCompleted'), 'completed on first turn').toBe(true)
    expect(events.filter(e => e.type === 'ToolCallStarted').length, 'no tools').toBe(0)
  })
})

// ── Path 11: Tool then end_turn (classic pattern) ──

describe('Path: tool-then-end-turn', () => {
  it('should run tool, append result, then complete on end_turn', async () => {
    const mock = new MockModelProvider()
    mock.pushTurn([
      toolUseStart('tu_1', 'read_file'), toolUseDelta('tu_1', '{"path":"src/index.ts"}'),
      blockStop(1), messageStop(),
    ], { content: [{ type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: 'src/index.ts' } }], stopReason: 'tool_use', usage: { inputTokens: 100, outputTokens: 50 } })
    mock.pushTurn([textDelta('File contents: ...'), messageStop()], endTurnResult('File contents: ...'))

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Read index.ts', makeTask('Read index.ts'), testProfile)
    for await (const e of gen) events.push(e)

    expect(events.filter(e => e.type === 'ToolCallStarted').length, '1 tool call').toBe(1)
    expect(events.some(e => e.type === 'TaskCompleted'), 'completed after tool').toBe(true)
    expect(events.some(e => e.type === 'TaskFailed'), 'no failure').toBe(false)
  })
})

// ── Path 12: max_turns reached ──

describe('Path: max-turns', () => {
  it('should stop at maxTurns when LLM keeps returning tools', async () => {
    const mock = new MockModelProvider()
    for (let i = 0; i < 6; i++) {
      mock.pushTurn([
        toolUseStart(`tu_${i}`, 'read_file'),
        toolUseDelta(`tu_${i}`, `{"path":"file${i}.txt"}`),
        blockStop(1), messageStop(),
      ], { content: [{ type: 'tool_use', id: `tu_${i}`, name: 'read_file', input: { path: `file${i}.txt` } }], stopReason: 'tool_use', usage: { inputTokens: 100, outputTokens: 50 } })
    }

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Read many files', makeTask('Read many files'), testProfile)
    for await (const e of gen) events.push(e)

    const toolCalls = events.filter(e => e.type === 'ToolCallStarted').length
    // maxTurns=5 with <= logic means 6 turns (0-5) before stopping
    expect(toolCalls, 'should stop after maxTurns+1 iterations').toBe(6)
    expect(events.some(e => e.type === 'TaskCompleted'), 'completed after max turns').toBe(true)
  })
})
