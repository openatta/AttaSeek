/**
 * VCR (Record & Replay) unit tests.
 *
 * Tests that VCRRecorder writes valid JSONL and VCRReplayer reads it back
 * with correct request matching. Uses temp directories — no real API calls.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  VCRRecorder,
  VCRReplayer,
  hashRequest,
  setVCRDir,
} from '../../../src/main/agent/llm/vcr'
import type { LLMChatParams } from '../../../src/main/agent/llm/ModelProvider'

// ── Helpers ──

let tmpDir: string

function makeParams(overrides?: Partial<LLMChatParams>): LLMChatParams {
  return {
    systemPrompt: 'You are a test agent.',
    messages: [{ role: 'user', content: 'Hello' }],
    tools: [],
    model: 'test-model',
    ...overrides,
  }
}

function makeResult(overrides?: Record<string, unknown>) {
  return {
    content: [{ type: 'text', text: 'Hello! How can I help you?' }],
    stopReason: 'end_turn' as const,
    usage: { inputTokens: 10, outputTokens: 8 },
    ...overrides,
  }
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'attaseek-vcr-test-'))
  setVCRDir(tmpDir)
})

afterAll(() => {
  setVCRDir(null)
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ── Tests ──

describe('VCRRecorder', () => {
  it('should record a request and write a valid JSONL file', async () => {
    const recorder = new VCRRecorder('test-scenario')
    const params = makeParams()
    const result = makeResult()

    recorder.record(params, result)
    await recorder.close()

    const filePath = path.join(tmpDir, 'test-scenario.jsonl')
    expect(fs.existsSync(filePath)).toBe(true)

    const content = fs.readFileSync(filePath, 'utf-8').trim()
    expect(content).toBeTruthy()

    const entry = JSON.parse(content)
    expect(entry.requestHash).toBeTruthy()
    expect(entry.request.systemPrompt).toBe('You are a test agent.')
    expect(entry.response.content[0].text).toBe('Hello! How can I help you?')
    expect(entry.response.usage.inputTokens).toBe(10)
  })
})

describe('VCRReplayer', () => {
  it('should replay a matching request', async () => {
    const recorder = new VCRRecorder('replay-test')
    const params = makeParams()
    const result = makeResult()
    const chunks = [{ type: 'text_delta' as const, text: 'Hello' }]

    recorder.record(params, result, chunks)
    await recorder.close()

    const replayer = new VCRReplayer('replay-test')
    const replayed = replayer.replayChat(params)

    expect(replayed).not.toBeNull()
    expect(replayed!.content[0]).toMatchObject({ type: 'text', text: 'Hello! How can I help you?' })
    expect(replayed!.stopReason).toBe('end_turn')
    expect(replayed!.usage).toEqual({ inputTokens: 10, outputTokens: 8 })
  })

  it('should return null for non-matching requests', async () => {
    const recorder = new VCRRecorder('no-match-test')
    recorder.record(makeParams({ model: 'model-a' }), makeResult())
    await recorder.close()

    const replayer = new VCRReplayer('no-match-test')
    const replayed = replayer.replayChat(makeParams({ model: 'model-b' }))

    expect(replayed).toBeNull()
  })

  it('should replay streaming chunks in order', async () => {
    const recorder = new VCRRecorder('stream-test')
    const params = makeParams()
    const result = makeResult()
    const chunks = [
      { type: 'text_delta' as const, text: 'Part A. ' },
      { type: 'text_delta' as const, text: 'Part B.' },
    ]

    recorder.record(params, result, chunks)
    await recorder.close()

    const replayer = new VCRReplayer('stream-test')
    const receivedChunks: Array<{ type: string; text?: string }> = []

    const replayed = await replayer.replayStream(params, (chunk) => {
      receivedChunks.push(chunk)
    })

    expect(replayed).not.toBeNull()
    expect(receivedChunks.length).toBe(2)
    expect(receivedChunks[0].text).toBe('Part A. ')
    expect(receivedChunks[1].text).toBe('Part B.')
  })
})

describe('hashRequest', () => {
  it('should produce deterministic hashes', () => {
    const a = hashRequest(makeParams())
    const b = hashRequest(makeParams())
    expect(a).toBe(b)
  })

  it('should produce different hashes for different models', () => {
    const a = hashRequest(makeParams({ model: 'model-a' }))
    const b = hashRequest(makeParams({ model: 'model-b' }))
    expect(a).not.toBe(b)
  })

  it('should produce different hashes for different tools', () => {
    const a = hashRequest(makeParams())
    const b = hashRequest(makeParams({
      tools: [{ name: 'Read', description: 'Read files', input_schema: {} }],
    }))
    expect(a).not.toBe(b)
  })
})
