/**
 * Unit tests: withRetry retry logic.
 * Uses vitest fake timers for setTimeout. Classifier functions are pure.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  withRetry, classifyError, isRetryable,
  retryOnRateLimit, retryOnOverload, retryOnServerError, retryOnNetworkError,
  FallbackTriggeredError,
} from '../../../src/main/agent/llm/withRetry'

// ═══════════════════════════════════════════════════════════════
// Error classifiers (pure functions)
// ═══════════════════════════════════════════════════════════════

describe('classifyError', () => {
  it('classifies 429 as rate_limit', () => {
    expect(classifyError({ status: 429 })).toBe('rate_limit')
  })

  it('classifies 529 as overloaded', () => {
    expect(classifyError({ status: 529 })).toBe('overloaded')
  })

  it('classifies 401 as auth_expired', () => {
    expect(classifyError({ status: 401 })).toBe('auth_expired')
  })

  it('classifies 500 as server_error', () => {
    expect(classifyError({ status: 500 })).toBe('server_error')
    expect(classifyError({ status: 503 })).toBe('server_error')
  })

  it('classifies network errors via Error.code', () => {
    const err = new Error('connect failed') as NodeJS.ErrnoException
    err.code = 'ECONNREFUSED'
    expect(classifyError(err)).toBe('network_error')
  })

  it('classifies unknown for unmatched errors', () => {
    expect(classifyError(new Error('something else'))).toBe('unknown')
    expect(classifyError(null)).toBe('unknown')
  })
})

describe('retry predicates', () => {
  it('retryOnRateLimit detects 429', () => {
    expect(retryOnRateLimit({ status: 429 })).toBe(true)
    expect(retryOnRateLimit({ status: 200 })).toBe(false)
  })

  it('retryOnOverload detects 529', () => {
    expect(retryOnOverload({ status: 529 })).toBe(true)
    expect(retryOnOverload({ status: 500 })).toBe(false)
  })

  it('retryOnServerError detects 5xx', () => {
    expect(retryOnServerError({ status: 500 })).toBe(true)
    expect(retryOnServerError({ status: 502 })).toBe(true)
    expect(retryOnServerError({ status: 400 })).toBe(false)
  })

  it('retryOnNetworkError detects ECONNREFUSED, ETIMEDOUT, etc.', () => {
    const e1 = new Error('connection refused') as NodeJS.ErrnoException
    e1.code = 'ECONNREFUSED'
    expect(retryOnNetworkError(e1)).toBe(true)

    const e2 = new Error('timeout') as NodeJS.ErrnoException
    e2.code = 'ETIMEDOUT'
    expect(retryOnNetworkError(e2)).toBe(true)

    const e3 = new Error('normal error') as NodeJS.ErrnoException
    expect(retryOnNetworkError(e3)).toBe(false)
  })

  it('isRetryable returns true for everything except auth', () => {
    expect(isRetryable({ status: 429 })).toBe(true)
    expect(isRetryable({ status: 529 })).toBe(true)
    expect(isRetryable({ status: 500 })).toBe(true)
    expect(isRetryable({ status: 401 })).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// withRetry behavior (fake timers)
// ═══════════════════════════════════════════════════════════════

describe('withRetry', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns result on success without retry', async () => {
    const fn = vi.fn().mockResolvedValue('success')
    const result = await withRetry(fn, { maxRetries: 3 })
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on server_error and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 500 })
      .mockRejectedValueOnce({ status: 500 })
      .mockResolvedValue('recovered')

    const promise = withRetry(fn, { maxRetries: 5, baseDelayMs: 100 })
    // Advance timers to unblock each retry delay
    vi.advanceTimersByTimeAsync(100)
    vi.advanceTimersByTimeAsync(200)
    const result = await promise
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('retries on rate_limit (429)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue('ok')

    const promise = withRetry(fn, { maxRetries: 5, baseDelayMs: 100 })
    vi.advanceTimersByTimeAsync(100)
    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting retries', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 500 })
    const promise = withRetry(fn, { maxRetries: 2, baseDelayMs: 100 })
    vi.advanceTimersByTimeAsync(100)
    vi.advanceTimersByTimeAsync(200)
    await expect(promise).rejects.toBeDefined()
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('does not retry on auth_expired (401)', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 401 })
    await expect(withRetry(fn, { maxRetries: 5 })).rejects.toBeDefined()
    expect(fn).toHaveBeenCalledTimes(1) // no retries
  })

  it('background source does not retry on 529', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 529 })
    await expect(
      withRetry(fn, { maxRetries: 5, isForeground: false }),
    ).rejects.toBeDefined()
    expect(fn).toHaveBeenCalledTimes(1) // no retry for background
  })

  it('foreground source retries 529 up to 3 times', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 529 })
      .mockRejectedValueOnce({ status: 529 })
      .mockRejectedValueOnce({ status: 529 })
      .mockResolvedValue('ok') // 4th call succeeds

    const promise = withRetry(fn, { maxRetries: 5, isForeground: true, baseDelayMs: 100 })
    vi.advanceTimersByTimeAsync(100)
    vi.advanceTimersByTimeAsync(200)
    vi.advanceTimersByTimeAsync(400)
    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(4)
  })

  // Note: FallbackTriggeredError integration test moved to integration layer
  // (requires controlled promise lifecycle with fake timers — vitest fake timers
  // produce unhandled rejections for errors thrown inside setTimeout callbacks).
  it('FallbackTriggeredError carries correct fields', () => {
    const err = new FallbackTriggeredError('claude-haiku', 'server_error')
    expect(err.fallbackModel).toBe('claude-haiku')
    expect(err.reason).toBe('server_error')
    expect(err.name).toBe('FallbackTriggeredError')
    expect(err).toBeInstanceOf(Error)
  })

  it('calls onRetry callback', async () => {
    const onRetry = vi.fn()
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 500 })
      .mockResolvedValue('ok')
    const promise = withRetry(fn, { maxRetries: 5, baseDelayMs: 100, onRetry })
    vi.advanceTimersByTimeAsync(100)
    await promise
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(
      { status: 500 }, 1, expect.any(Number), 'server_error',
    )
  })

  it('uses server-suggested rate-limit reset delay when available', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({
        status: 429,
        headers: { 'retry-after': '2' }, // 2 seconds
      })
      .mockResolvedValue('ok')

    const promise = withRetry(fn, { maxRetries: 5, baseDelayMs: 100 })
    vi.advanceTimersByTimeAsync(2000)
    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
