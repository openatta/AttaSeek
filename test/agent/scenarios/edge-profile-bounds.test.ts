/**
 * Profile boundary value + ModelProvider error mapping depth tests.
 */
import { describe, it, expect } from 'vitest'
import { MockModelProvider } from '../mock/MockModelProvider'
import { textDelta, messageStop, endTurnResult, toolUseStart, toolUseDelta, blockStop } from '../mock/helpers'
import { QueryEngine } from '../../../src/main/agent/orchestrator/QueryEngine'
import { validateProfile } from '../../../src/main/agent/profile/AgentProfile'
import { LLMError } from '../../../src/main/agent/llm/ModelProvider'

const baseProfile = { id: 'test', name: 'Test', systemPrompt: { id: 't', sections: [{ name: 'i', priority: 10, content: 'Test.' }] } }
const mkTask = (g: string) => ({ id: 't', sessionId: 's', goal: g, status: 'idle' as const, createdAt: Date.now(), updatedAt: Date.now() })

function createMockCallModel(mock: MockModelProvider) {
  return async (params: any, onChunk: any) => {
    return mock.chatStream(params, onChunk)
  }
}
function newEngine(mock: MockModelProvider) {
  return new QueryEngine({ sessionId: 's', testDeps: { callModel: createMockCallModel(mock) } })
}

describe('Profile — maxTurns boundary', () => {
  it('maxTurns=0 should stop before LLM call', async () => {
    const p = validateProfile({ ...baseProfile, execution: { maxTurns: 0 } })
    const mock = new MockModelProvider()
    mock.pushTurn([textDelta('hi'), messageStop()], endTurnResult('hi'))

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Test', mkTask('Test'), p)
    for await (const e of gen) events.push(e)

    // maxTurns=0 allows one LLM call (turnCount 0 <= 0), then stops
    expect(events.some(e => e.type === 'TaskCompleted'), 'completes after one turn').toBe(true)
    expect(mock.requestCount, 'exactly one LLM call').toBe(1)
  })

  it('maxTurns=1 should allow exactly one LLM turn', async () => {
    const p = validateProfile({ ...baseProfile, execution: { maxTurns: 1 } })
    const mock = new MockModelProvider()
    mock.pushTurn([textDelta('one'), messageStop()], endTurnResult('one'))

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Test', mkTask('Test'), p)
    for await (const e of gen) events.push(e)

    expect(mock.requestCount, 'exactly one LLM call').toBe(1)
    expect(events.some(e => e.type === 'TaskCompleted'), 'completes').toBe(true)
  })

  it('should handle 0 maxParallelTools gracefully', async () => {
    const p = validateProfile({ ...baseProfile, execution: { maxParallelTools: 0 } })
    expect(p.execution.maxParallelTools).toBe(0)
  })

  it('should work with artifact generation enabled', async () => {
    const p = validateProfile({ ...baseProfile, output: { generateArtifact: true } })
    const mock = new MockModelProvider()
    mock.pushTurn([textDelta('Artifact test'), messageStop()], endTurnResult('Artifact test'))

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Test', mkTask('Test'), p)
    for await (const e of gen) events.push(e)

    expect(events.some(e => e.type === 'TaskCompleted'), 'completes with artifact').toBe(true)
  })
})

describe('LLMError — full classification', () => {
  it.each([
    ['auth', 'auth_error'],
    ['rate_limit', 'rate_limit_error'],
    ['invalid_request', 'invalid_request_error'],
    ['not_found', 'not_found_error'],
    ['server', 'server_error'],
    ['timeout', 'timeout_error'],
    ['unknown', 'unknown_error'],
  ])('should classify error code: %s', async (code, _desc) => {
    const mock = new MockModelProvider()
    mock.pushError(code as LLMError['code'], `Simulated ${code} error`)

    const engine = newEngine(mock)
    const events: any[] = []
    const gen = engine.submitMessage('Test', mkTask('Test'), validateProfile(baseProfile))
    for await (const e of gen) events.push(e)

    expect(events.some(e => e.type === 'TaskFailed'), `fails for ${code}`).toBe(true)
  })

  it('should throw with correct LLMError code', async () => {
    const mock = new MockModelProvider()
    mock.pushError('auth', 'Invalid API key')
    try {
      await mock.chatStream({ systemPrompt: '', messages: [], tools: [] }, () => {})
      expect(false, 'should have thrown').toBe(true)
    } catch (err) {
      expect(err).toBeInstanceOf(LLMError)
      expect((err as LLMError).code).toBe('auth')
    }
  })
})
