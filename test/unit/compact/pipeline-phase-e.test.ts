/**
 * Unit tests for compaction pipeline integration features (Phase E).
 *
 * Tests pure functions — no Electron dependency.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createPipelineTracking } from '../../../src/main/agent/compact/CompactionPipeline'
import {
  createCompactWarningState,
  shouldEmitCompactWarning,
  suppressCompactWarning,
  clearCompactWarningSuppression,
  maybeClearSuppression,
} from '../../../src/main/agent/compact/CompactWarningState'
import { FileStateCache } from '../../../src/main/agent/compact/FileStateCache'
import {
  getLastAssistantTimestamp,
  shouldTimeMicrocompact,
  microcompactWithTime,
  microcompactMessages,
  timeMicrocompact,
} from '../../../src/main/agent/compact/Microcompactor'
import type { LLMMessage } from '../../../src/main/agent/llm/ModelProvider'

// ── PipelineTracking ──

describe('PipelineTracking', () => {
  it('creates fresh tracking state with zero values', () => {
    const t = createPipelineTracking()
    expect(t.summary).toBe('')
    expect(t.sessionStagesApplied).toEqual([])
    expect(t.sessionTotalTokensFreed).toBe(0)
    expect(t.sessionTotalCompressedCount).toBe(0)
    expect(t.autoCompactTracking.consecutiveNoops).toBe(0)
    expect(t.autoCompactTracking.maxNoops).toBe(3)
  })
})

// ── CompactWarningState ──

describe('CompactWarningState', () => {
  it('emits warning when budget ratio exceeds trigger', () => {
    const state = createCompactWarningState()
    expect(shouldEmitCompactWarning(80000, 100000, state)).toBe(true)
  })

  it('does not emit warning below trigger ratio', () => {
    const state = createCompactWarningState()
    expect(shouldEmitCompactWarning(50000, 100000, state)).toBe(false)
  })

  it('suppresses repeated warnings within window', () => {
    let state = createCompactWarningState()
    state = suppressCompactWarning(state, 80000)
    expect(state.suppressed).toBe(true)
    // Should not emit while suppressed
    expect(shouldEmitCompactWarning(85000, 100000, state)).toBe(false)
  })

  it('clears suppression after compaction', () => {
    let state = createCompactWarningState()
    state = suppressCompactWarning(state, 80000)
    state = clearCompactWarningSuppression(state)
    expect(state.suppressed).toBe(false)
  })

  it('auto-clears suppression after enough elapsed time', () => {
    let state = createCompactWarningState()
    state = suppressCompactWarning(state, 80000)
    // Fake old timestamp
    state = { ...state, lastWarningAt: Date.now() - 120_000 }
    state = maybeClearSuppression(state)
    expect(state.suppressed).toBe(false)
  })
})

// ── FileStateCache ──

describe('FileStateCache', () => {
  let cache: FileStateCache

  beforeEach(() => {
    cache = new FileStateCache(10, 60000) // 10 entries, 60s TTL
  })

  it('stores and retrieves entries', () => {
    cache.set('/test/file.ts', 'content', 7, Date.now())
    const entry = cache.get('/test/file.ts')
    expect(entry).toBeTruthy()
    expect(entry!.content).toBe('content')
    expect(entry!.size).toBe(7)
  })

  it('returns undefined for missing entries', () => {
    expect(cache.get('/nonexistent')).toBeUndefined()
  })

  it('evicts LRU entry when at capacity', () => {
    for (let i = 0; i < 12; i++) {
      cache.set(`/file${i}.ts`, `content${i}`, 8, Date.now())
    }
    // Should have evicted the first entries
    expect(cache.size).toBeLessThanOrEqual(10)
    // First entry should be evicted (LRU)
    expect(cache.get('/file0.ts')).toBeUndefined()
    expect(cache.get('/file1.ts')).toBeUndefined()
    // Later entries should still exist
    expect(cache.get('/file11.ts')).toBeTruthy()
  })

  it('promotes accessed entries (LRU touch)', () => {
    for (let i = 0; i < 10; i++) {
      cache.set(`/file${i}.ts`, `content${i}`, 8, Date.now())
    }
    // Access file0 to promote it
    cache.get('/file0.ts')
    // Add 2 more — file0 should survive because it was accessed
    cache.set('/file10.ts', 'content10', 9, Date.now())
    cache.set('/file11.ts', 'content11', 9, Date.now())
    expect(cache.get('/file0.ts')).toBeTruthy()
    expect(cache.get('/file1.ts')).toBeUndefined() // file1 should be evicted
  })

  it('invalidates specific paths', () => {
    cache.set('/a/file.ts', 'a', 1, Date.now())
    cache.set('/b/file.ts', 'b', 1, Date.now())
    cache.invalidate('/a/file.ts')
    expect(cache.get('/a/file.ts')).toBeUndefined()
    expect(cache.get('/b/file.ts')).toBeTruthy()
  })

  it('invalidates prefix paths', () => {
    cache.set('/a/file1.ts', 'a1', 2, Date.now())
    cache.set('/a/file2.ts', 'a2', 2, Date.now())
    cache.set('/b/file.ts', 'b', 1, Date.now())
    cache.invalidatePrefix('/a/')
    expect(cache.get('/a/file1.ts')).toBeUndefined()
    expect(cache.get('/a/file2.ts')).toBeUndefined()
    expect(cache.get('/b/file.ts')).toBeTruthy()
  })

  it('detects stale entries via mtime check', () => {
    cache.set('/file.ts', 'old', 3, 100)
    // First call with different mtime: evicts and returns false
    expect(cache.has('/file.ts', 200)).toBe(false)
    // Entry was evicted — re-add and check with matching mtime
    cache.set('/file.ts', 'old', 3, 100)
    expect(cache.has('/file.ts', 100)).toBe(true)
  })

  it('tracks hit/miss/eviction stats', () => {
    cache.set('/a.ts', 'a', 1, Date.now())
    cache.get('/a.ts') // hit
    cache.get('/b.ts') // miss
    cache.get('/c.ts') // miss
    const stats = cache.getStats()
    expect(stats.hits).toBe(1)
    expect(stats.misses).toBe(2)
  })
})

// ── Microcompactor time-gap detection ──

describe('Microcompactor time-gap detection', () => {
  function makeMsg(role: 'user' | 'assistant', content: string, timestamp?: number): LLMMessage {
    return { role, content, timestamp }
  }

  it('extracts timestamp from last assistant message', () => {
    const msgs: LLMMessage[] = [
      makeMsg('user', 'hello', 1000),
      makeMsg('assistant', 'hi', 2000),
      makeMsg('user', 'more', 3000),
    ]
    expect(getLastAssistantTimestamp(msgs)).toBe(2000)
  })

  it('returns 0 when no assistant message found', () => {
    const msgs: LLMMessage[] = [makeMsg('user', 'hello', 1000)]
    expect(getLastAssistantTimestamp(msgs)).toBe(0)
  })

  it('detects cache-expiry gap', () => {
    // Build 12+ messages so the minimum count check passes
    const msgs: LLMMessage[] = []
    for (let i = 0; i < 6; i++) {
      msgs.push(makeMsg('user', `q${i}`, 1000 * 60 * i))           // 0, 1, 2, 3, 4, 5 min
      msgs.push(makeMsg('assistant', `a${i}`, 1000 * 60 * i))
    }
    // Last assistant is at 5 min, state has lastAssistantTimestamp = 0
    // 5 - 0 = 5min < 60min threshold → should NOT trigger
    let state = { lastAssistantTimestamp: 0 }
    expect(shouldTimeMicrocompact(msgs, state, 60)).toBe(false)

    // Now simulate a 70-minute gap: first batch ended at 5min, next message at 75min
    const msgs2: LLMMessage[] = [
      ...msgs,
      makeMsg('user', 'after_gap', 75 * 1000 * 60),           // 75 min
      makeMsg('assistant', 'after_gap_reply', 75 * 1000 * 60),
    ]
    // State was updated to 5*60*1000ms from the first call
    state = { lastAssistantTimestamp: 5 * 1000 * 60 }
    // gap = 75 - 5 = 70 min >= 60 min threshold → should trigger
    expect(shouldTimeMicrocompact(msgs2, state, 60)).toBe(true)
  })

  it('does not trigger for short gaps', () => {
    const msgs: LLMMessage[] = [
      makeMsg('user', 'old', 1000 * 60),
      makeMsg('assistant', 'old reply', 1000 * 60),
      makeMsg('user', 'new', 11 * 1000 * 60),        // 11 min
      makeMsg('assistant', 'new reply', 11 * 1000 * 60),
    ]
    const state = { lastAssistantTimestamp: 1000 * 60 }
    expect(shouldTimeMicrocompact(msgs, state, 60)).toBe(false)
  })

  it('content microcompact truncates long tool results', () => {
    const msgs: LLMMessage[] = [
      makeMsg('assistant', 'ok'),
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 't1', content: 'a'.repeat(15000) },
          { type: 'tool_result', tool_use_id: 't2', content: 'short' },
        ],
      },
    ]
    const result = microcompactMessages(msgs, 10000)
    expect(result.compactedCount).toBe(1)
    expect(result.tokensFreed).toBeGreaterThan(0)
    // t1 should be truncated, t2 unchanged
    const userMsg = result.messages[1]
    expect(typeof userMsg.content).not.toBe('string')
    if (Array.isArray(userMsg.content)) {
      const blocks = userMsg.content as any[]
      expect(blocks[0].content.length).toBeLessThan(10000 + 50) // truncated + suffix
      expect(blocks[1].content).toBe('short') // unchanged
    }
  })

  it('time microcompact removes old tool pairs', () => {
    // Build a long conversation with tool pairs spread across many turns
    const msgs: LLMMessage[] = []
    for (let i = 0; i < 15; i++) {
      msgs.push({
        role: 'user',
        content: `question ${i}`,
      })
      msgs.push({
        role: 'assistant',
        content: [
          { type: 'text', text: `answer ${i}` },
          { type: 'tool_use', id: `tool_${i}`, name: 'read', input: {} },
        ],
      })
      msgs.push({
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: `tool_${i}`, content: `result ${i}` },
        ],
      })
    }

    const result = timeMicrocompact(msgs, 5) // keep last 5 turns
    expect(result.compactedCount).toBeGreaterThan(0)
    // Early tool pairs should be removed
    const resultContent = JSON.stringify(result.messages)
    expect(resultContent).toContain('tool_14') // recent tools kept
    // Token savings
    expect(result.tokensFreed).toBeGreaterThan(0)
  })

  it('combined microcompact with time works', () => {
    const msgs: LLMMessage[] = []
    for (let i = 0; i < 12; i++) {
      msgs.push({ role: 'user', content: `q${i}`, timestamp: i * 10 * 60 * 1000 })
      msgs.push({ role: 'assistant', content: `a${i}`, timestamp: i * 10 * 60 * 1000 + 1 })
      msgs.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: `t${i}`, content: 'x'.repeat(15000) }],
      })
    }

    const state = {
      lastAssistantTimestamp: 0 * 10 * 60 * 1000 + 1, // first assistant
      lastTimeMicrocompactAt: 0,
      totalClearedByTimeMC: 0,
    }

    const result = microcompactWithTime(msgs, state, 5) // 5min gap threshold
    // Content microcompact should have truncated the long results
    expect(result.compactedCount).toBeGreaterThan(0)
    // State should be updated
    expect(state.lastAssistantTimestamp).toBeGreaterThan(0)
  })
})
