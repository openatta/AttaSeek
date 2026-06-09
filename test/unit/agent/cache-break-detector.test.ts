/**
 * Unit tests for CacheBreakDetector — cache state capture and comparison.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CacheBreakDetector } from '../../../src/main/agent/llm/cache-break-detector'

describe('CacheBreakDetector', () => {
  let detector: CacheBreakDetector

  beforeEach(() => {
    detector = new CacheBreakDetector()
  })

  const baseParams = {
    systemPrompt: 'You are a helpful assistant.',
    tools: [
      { name: 'read_file', description: 'Read a file', input_schema: {} },
      { name: 'write_file', description: 'Write a file', input_schema: {} },
    ],
    modelId: 'claude-sonnet-4-6',
    messageCharCount: 500,
    isFastMode: false,
    querySource: 'repl_main_thread',
  }

  describe('capture', () => {
    it('returns a CacheState with hashes', () => {
      const state = detector.capture(baseParams)

      expect(state.systemPromptHash).toHaveLength(16)
      expect(state.toolsHash).toHaveLength(16)
      expect(state.modelId).toBe('claude-sonnet-4-6')
      expect(state.messageCharCount).toBe(500)
      expect(state.isFastMode).toBe(false)
      expect(state.querySource).toBe('repl_main_thread')
      expect(state.capturedAt).toBeGreaterThan(0)
    })

    it('produces different hashes for different system prompts', () => {
      const s1 = detector.capture({ ...baseParams, systemPrompt: 'prompt A' })
      const s2 = detector.capture({ ...baseParams, systemPrompt: 'prompt B' })

      expect(s1.systemPromptHash).not.toBe(s2.systemPromptHash)
    })

    it('produces same hashes for identical inputs', () => {
      const s1 = detector.capture(baseParams)
      const s2 = detector.capture(baseParams)

      expect(s1.systemPromptHash).toBe(s2.systemPromptHash)
      expect(s1.toolsHash).toBe(s2.toolsHash)
    })

    it('produces different toolsHash when tools change', () => {
      const s1 = detector.capture(baseParams)
      const s2 = detector.capture({
        ...baseParams,
        tools: [{ name: 'bash', description: 'Run a command', input_schema: {} }],
      })

      expect(s1.toolsHash).not.toBe(s2.toolsHash)
    })

    it('toolsHash is stable regardless of tool order', () => {
      const s1 = detector.capture({
        ...baseParams,
        tools: [
          { name: 'read_file', description: 'Read a file', input_schema: {} },
          { name: 'bash', description: 'Run a command', input_schema: {} },
        ],
      })
      const s2 = detector.capture({
        ...baseParams,
        tools: [
          { name: 'bash', description: 'Run a command', input_schema: {} },
          { name: 'read_file', description: 'Read a file', input_schema: {} },
        ],
      })

      expect(s1.toolsHash).toBe(s2.toolsHash)
    })
  })

  describe('diagnose', () => {
    it('reports expected=true on first call (no previous state = cache expected to break)', () => {
      const state = detector.capture(baseParams)
      const diagnostic = detector.diagnose(state)

      expect(diagnostic.expected).toBe(true)
      expect(diagnostic.previous).toBeNull()
      expect(diagnostic.changedFields).toEqual(['initial'])
    })

    it('reports expected=false when nothing changed (unexpected cache break)', () => {
      const s1 = detector.capture(baseParams)
      detector.diagnose(s1) // establish baseline

      const s2 = detector.capture(baseParams) // identical params
      const diagnostic = detector.diagnose(s2)

      expect(diagnostic.expected).toBe(false)
      expect(diagnostic.changedFields).toContain('unexpected_break_#1')
    })

    it('detects systemPrompt change (field name: systemPrompt)', () => {
      const s1 = detector.capture(baseParams)
      detector.diagnose(s1)

      const s2 = detector.capture({ ...baseParams, systemPrompt: 'Different prompt' })
      const diagnostic = detector.diagnose(s2)

      expect(diagnostic.expected).toBe(true)
      expect(diagnostic.changedFields).toContain('systemPrompt')
    })

    it('detects tools change (field name: tools)', () => {
      const s1 = detector.capture(baseParams)
      detector.diagnose(s1)

      const s2 = detector.capture({
        ...baseParams,
        tools: [...baseParams.tools, { name: 'bash', description: 'Run', input_schema: {} }],
      })
      const diagnostic = detector.diagnose(s2)

      expect(diagnostic.expected).toBe(true)
      expect(diagnostic.changedFields).toContain('tools')
    })

    it('detects modelId change', () => {
      const s1 = detector.capture(baseParams)
      detector.diagnose(s1)

      const s2 = detector.capture({ ...baseParams, modelId: 'claude-opus-4-8' })
      const diagnostic = detector.diagnose(s2)

      expect(diagnostic.expected).toBe(true)
      expect(diagnostic.changedFields).toContain('modelId')
    })

    it('detects fastMode change (field name: fastMode)', () => {
      const s1 = detector.capture(baseParams)
      detector.diagnose(s1)

      const s2 = detector.capture({ ...baseParams, isFastMode: true })
      const diagnostic = detector.diagnose(s2)

      expect(diagnostic.expected).toBe(true)
      expect(diagnostic.changedFields).toContain('fastMode')
    })

    it('detects multiple changed fields', () => {
      const s1 = detector.capture(baseParams)
      detector.diagnose(s1)

      const s2 = detector.capture({
        ...baseParams,
        systemPrompt: 'New prompt',
        modelId: 'claude-haiku',
      })
      const diagnostic = detector.diagnose(s2)

      expect(diagnostic.expected).toBe(true)
      expect(diagnostic.changedFields).toContain('systemPrompt')
      expect(diagnostic.changedFields).toContain('modelId')
    })

    it('tracks unexpected breaks across diagnoses', () => {
      let state = detector.capture(baseParams)
      detector.diagnose(state) // first call: expected=true

      // Same params — unexpected
      state = detector.capture(baseParams)
      let diagnostic = detector.diagnose(state)
      expect(diagnostic.expected).toBe(false)
      expect(diagnostic.changedFields).toContain('unexpected_break_#1')

      // Same params again — second unexpected
      state = detector.capture(baseParams)
      diagnostic = detector.diagnose(state)
      expect(diagnostic.expected).toBe(false)
      expect(diagnostic.changedFields).toContain('unexpected_break_#2')
    })
  })
})
