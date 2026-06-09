/**
 * Unit tests: SnipCompactor + Microcompactor pure functions.
 * Zero dependencies — no mocks needed.
 */
import { describe, it, expect } from 'vitest'
import { snipCompact, aggressiveSnip, findSnipBoundary } from '../../../src/main/agent/compact/SnipCompactor'
import { microcompactResults, microcompactMessages, timeMicrocompact } from '../../../src/main/agent/compact/Microcompactor'
import type { LLMMessage, LLMContentBlock } from '../../../src/main/agent/llm/ModelProvider'

// ── Helpers ──

function msg(role: 'user' | 'assistant', content: string | LLMContentBlock[]): LLMMessage {
  return { role, content }
}
function textBlock(text: string): LLMContentBlock { return { type: 'text', text } }
function toolUseBlock(id: string, name: string, input: unknown = {}): LLMContentBlock {
  return { type: 'tool_use', id, name, input }
}
function toolResultBlock(tool_use_id: string, content: string): LLMContentBlock {
  return { type: 'tool_result', tool_use_id, content }
}

// ═══════════════════════════════════════════════════════════════
// SnipCompactor
// ═══════════════════════════════════════════════════════════════

describe('SnipCompactor', () => {
  describe('snipCompact', () => {
    it('returns unchanged when below minMessages', () => {
      const msgs = [msg('user', 'hi'), msg('assistant', 'hello')]
      const r = snipCompact(msgs, { minMessages: 10 })
      expect(r.didSnip).toBe(false)
      expect(r.messages).toEqual(msgs)
    })

    it('returns unchanged when tail covers head (short conversation)', () => {
      const msgs = Array.from({ length: 8 }, (_, i) =>
        msg(i % 2 === 0 ? 'user' : 'assistant', `msg ${i}`))
      const r = snipCompact(msgs, { keepHead: 2, keepTailTurns: 4, minMessages: 5 })
      expect(r.didSnip).toBe(false)
    })

    it('snips middle messages keeping head + tail', () => {
      const msgs: LLMMessage[] = []
      for (let i = 0; i < 30; i++) msgs.push(msg(i % 2 === 0 ? 'user' : 'assistant', `msg ${i}`))
      const r = snipCompact(msgs, { keepHead: 2, keepTailTurns: 3, minMessages: 10 })
      expect(r.didSnip).toBe(true)
      expect(r.removedCount).toBeGreaterThan(0)
      expect(r.tokensFreed).toBeGreaterThan(0)
      // Head preserved
      expect(r.messages[0]).toEqual(msgs[0])
      expect(r.messages[1]).toEqual(msgs[1])
      // Tail preserved (last 6 messages)
      const tail = r.messages.slice(-6)
      expect(tail).toEqual(msgs.slice(-6))
      // Boundary message between head and tail
      expect(r.boundaryMessage).toBeDefined()
      expect(r.boundaryMessage!.role).toBe('user')
    })

    it('keeps exact head+tail counts with explicit config', () => {
      const msgs: LLMMessage[] = []
      for (let i = 0; i < 40; i++) msgs.push(msg(i % 2 === 0 ? 'user' : 'assistant', `turn ${Math.floor(i / 2)}`))
      const r = snipCompact(msgs, { keepHead: 1, keepTailTurns: 5, minMessages: 15 })
      expect(r.didSnip).toBe(true)
      // head: 1 message, tail: 5*2 = 10 messages, boundary: 1 = 12 total
      expect(r.messages.length).toBe(12)
      expect(r.messages[0]).toEqual(msgs[0])
      expect(r.messages.slice(-10)).toEqual(msgs.slice(-10))
    })
  })

  describe('aggressiveSnip', () => {
    it('applies aggressive defaults', () => {
      const msgs: LLMMessage[] = []
      for (let i = 0; i < 25; i++) msgs.push(msg(i % 2 === 0 ? 'user' : 'assistant', `m${i}`))
      const r = aggressiveSnip(msgs)
      expect(r.didSnip).toBe(true)
      // keepHead:1, keepTailTurns:3, minMessages:10 → head + tail + boundary
      expect(r.messages.length).toBeLessThan(msgs.length)
      expect(r.messages.length).toBeGreaterThan(0)
    })
  })

  describe('findSnipBoundary', () => {
    it('finds topic boundary with English starters', () => {
      const msgs: LLMMessage[] = [
        msg('user', 'First task'), msg('assistant', 'Done'),
        msg('user', 'I want to refactor the auth module'), msg('assistant', 'Sure'),
        msg('user', 'Next task'), msg('assistant', 'OK'),
      ]
      const idx = findSnipBoundary(msgs, 2)
      // Should find the "I want..." message as topic boundary
      expect(idx).toBeGreaterThanOrEqual(0)
    })

    it('falls back to tailTurns when no topic boundary found', () => {
      const msgs: LLMMessage[] = []
      for (let i = 0; i < 20; i++) msgs.push(msg(i % 2 === 0 ? 'user' : 'assistant', `msg ${i}`))
      const idx = findSnipBoundary(msgs, 3)
      // Should be at messages.length - 3*2 = 14
      expect(idx).toBe(14)
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// Microcompactor
// ═══════════════════════════════════════════════════════════════

describe('Microcompactor', () => {
  describe('microcompactResults', () => {
    it('truncates long tool results', () => {
      const results = [{ content: 'short' }, { content: 'a'.repeat(15_000) }]
      const r = microcompactResults(results, 10_000)
      expect(r[0].content).toBe('short')
      expect(r[1].content.length).toBeLessThan(15_000)
      expect(r[1].content).toContain('[truncated')
    })

    it('leaves short results unchanged', () => {
      const results = [{ content: 'hello' }, { content: 'world' }]
      const r = microcompactResults(results, 10_000)
      expect(r).toEqual(results)
    })
  })

  describe('microcompactMessages', () => {
    it('truncates tool_result blocks in messages', () => {
      const msgs: LLMMessage[] = [{
        role: 'user',
        content: [toolResultBlock('tu_1', 'a'.repeat(15_000)), textBlock('summary')],
      }]
      const r = microcompactMessages(msgs, 10_000)
      expect(r.compactedCount).toBe(1)
      expect(r.tokensFreed).toBeGreaterThan(0)
      expect(r.pendingCacheEdits).toBeDefined()
      expect(r.pendingCacheEdits![0].toolUseId).toBe('tu_1')
      const resultBlock = (r.messages[0].content as LLMContentBlock[])[0]
      expect(resultBlock.type).toBe('tool_result')
      expect((resultBlock as { content: string }).content).toContain('[truncated')
    })

    it('leaves non-tool_result blocks untouched', () => {
      const msgs: LLMMessage[] = [{
        role: 'user',
        content: [textBlock('hello'), toolResultBlock('tu_2', 'short result')],
      }]
      const r = microcompactMessages(msgs, 10_000)
      expect(r.compactedCount).toBe(0)
      expect(r.pendingCacheEdits).toBeUndefined()
    })
  })

  describe('timeMicrocompact', () => {
    it('removes old tool_use/tool_result pairs beyond maxTurnsBack', () => {
      // Build: 20 turns of "user asks → assistant uses tool + gets result"
      const msgs: LLMMessage[] = []
      for (let turn = 0; turn < 20; turn++) {
        msgs.push(msg('user', `task ${turn}`))
        msgs.push({
          role: 'assistant',
          content: [textBlock(`working on ${turn}`), toolUseBlock(`tool_${turn}`, 'read_file')],
        })
        msgs.push({
          role: 'user',
          content: [toolResultBlock(`tool_${turn}`, `result ${turn}`)],
        })
      }
      const r = timeMicrocompact(msgs, 5) // keep last 5 turns
      expect(r.compactedCount).toBeGreaterThan(0)
      expect(r.tokensFreed).toBeGreaterThan(0)
    })

    it('does nothing when under maxTurnsBack', () => {
      const msgs: LLMMessage[] = [
        msg('user', 'hi'),
        { role: 'assistant', content: [textBlock('hello'), toolUseBlock('t1', 'read_file')] },
        { role: 'user', content: [toolResultBlock('t1', 'result')] },
      ]
      const r = timeMicrocompact(msgs, 10)
      expect(r.compactedCount).toBe(0)
    })
  })
})
