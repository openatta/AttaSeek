/**
 * withRetry — generic retry wrapper with exponential backoff.
 *
 * Inspired by Claude Code's withRetry pattern (src/services/api/withRetry.ts).
 * Used by LLM providers to handle transient API failures.
 */

/** Heuristic: rate-limit reset headers often suggest this many seconds */
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Base delay between retries in ms (default: 1000) */
  baseDelayMs?: number
  /** Maximum delay cap in ms (default: 30000) */
  maxDelayMs?: number
  /** Whether to add jitter to delay (default: true) */
  jitter?: boolean
  /** Custom retry predicate — receives the thrown error, returns true to retry */
  shouldRetry?: (err: unknown) => boolean
  /** Called before each retry attempt with (error, attemptNumber) */
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void
}

/**
 * Execute an async function with retry logic.
 * Returns the function's result on success, throws the last error if all retries exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 3
  const baseDelayMs = opts.baseDelayMs ?? 1000
  const maxDelayMs = opts.maxDelayMs ?? 30_000
  const useJitter = opts.jitter ?? true

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      if (attempt >= maxRetries) break

      // Check custom predicate if provided
      if (opts.shouldRetry && !opts.shouldRetry(err)) break

      // Default: retry on rate-limit, overload, and server errors
      if (!opts.shouldRetry && !isRetryable(err)) break

      // Use server-suggested delay for rate-limit/overload, fall back to exponential backoff
      const delayMs = (retryOnRateLimit(err) || retryOnOverload(err))
        ? getRateLimitDelay(err, attempt, baseDelayMs, maxDelayMs)
        : computeDelay(attempt, baseDelayMs, maxDelayMs, useJitter)
      opts.onRetry?.(err, attempt + 1, delayMs)

      await sleep(delayMs)
    }
  }

  throw lastError
}

// ── Built-in retry predicates ──

/** Check if an error is likely retryable (HTTP status based or network error) */
export function isRetryable(err: unknown): boolean {
  return retryOnRateLimit(err) || retryOnOverload(err) || retryOnServerError(err) || retryOnNetworkError(err)
}

/** 429 Too Many Requests */
export function retryOnRateLimit(err: unknown): boolean {
  return extractStatus(err) === 429
}

/** 529 Overloaded (Anthropic-specific) */
export function retryOnOverload(err: unknown): boolean {
  return extractStatus(err) === 529
}

/** 5xx server errors */
export function retryOnServerError(err: unknown): boolean {
  const status = extractStatus(err)
  return status !== undefined && status >= 500 && status < 600
}

/** Network/connection errors (no HTTP status) */
export function retryOnNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('fetch failed') || msg.includes('econnrefused') || msg.includes('enotfound')) return true
    if (msg.includes('socket hang up') || msg.includes('request timeout') || msg.includes('network')) return true
    // Node.js system errors have a code property
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'ECONNREFUSED') return true
  }
  return false
}

/** Get rate-limit reset delay from response headers, or fall back to exponential */
export function getRateLimitDelay(err: unknown, attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const resetSeconds = extractHeader(err, 'x-ratelimit-reset') ?? extractHeader(err, 'ratelimit-reset')
  if (resetSeconds) {
    const resetTime = Number(resetSeconds) * 1000
    const delay = Math.max(0, resetTime - Date.now())
    return Math.min(delay, maxDelayMs)
  }
  // Anthropic unified reset header
  const unifiedReset = extractHeader(err, 'anthropic-ratelimit-unified-reset')
  if (unifiedReset) {
    return Math.min(Number(unifiedReset) * 1000, maxDelayMs)
  }
  return computeDelay(attempt, baseDelayMs, maxDelayMs, true)
}

// ── Internal ──

function computeDelay(attempt: number, base: number, max: number, jitter: boolean): number {
  const exponential = Math.min(base * Math.pow(2, attempt), max)
  if (!jitter) return exponential
  // Full jitter: random between 0 and exponential
  return Math.random() * exponential
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractStatus(err: unknown): number | undefined {
  if (err instanceof Error) {
    const e = err as unknown as Record<string, unknown>
    if (typeof e.status === 'number') return e.status
    if (typeof e.statusCode === 'number') return e.statusCode
  }
  // Try nested error object (Anthropic SDK shape)
  const nested = tryNested(err, 'error', 'status') ?? tryNested(err, 'status')
  return typeof nested === 'number' ? nested : undefined
}

function extractHeader(err: unknown, name: string): string | undefined {
  const headers = tryNested(err, 'headers')
  if (headers && typeof headers === 'object') {
    const h = headers as Record<string, unknown>
    const val = h[name] ?? h[name.toLowerCase()]
    return typeof val === 'string' ? val : undefined
  }
  return undefined
}

function tryNested(obj: unknown, ...path: string[]): unknown {
  if (obj === null || obj === undefined) return undefined
  let current: unknown = obj
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}
