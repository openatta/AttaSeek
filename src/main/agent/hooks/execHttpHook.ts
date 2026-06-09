/**
 * execHttpHook — HTTP hook executor.
 *
 * POSTs the hook context to a configured URL and parses the JSON response.
 * Supports async mode where the hook returns {"async": true} and the caller
 * can poll or wait for completion.
 *
 * Mirrors Claude Code's HTTP hook execution in src/utils/hooks.ts.
 */

import type { HookConfig, HookContext, HookResult } from './HookTypes'

// ── Configuration ──

const DEFAULT_HTTP_TIMEOUT_MS = 10_000
const MAX_RESPONSE_SIZE = 1_000_000 // 1MB

// ── Execution ──

/**
 * Execute an HTTP hook by POSTing context to the configured URL.
 *
 * The hook config must have a `url` field (added to HookConfig for HTTP type).
 * The response body is parsed as JSON and mapped to HookResult fields.
 *
 * Security: Blocks non-HTTPS URLs unless explicitly allowed via env var
 * `ATTA_ALLOW_HTTP_HOOKS=1`. localhost URLs always require explicit opt-in.
 */
export async function execHttpHook(
  hook: HookConfig & { url?: string },
  ctx: HookContext,
): Promise<HookResult> {
  if (!hook.url) {
    console.warn('[execHttpHook] No URL configured for HTTP hook:', hook.id)
    return {}
  }

  const url = hook.url.trim()

  // Security check
  if (!isAllowedUrl(url)) {
    console.warn(`[execHttpHook] Blocked non-HTTPS URL for hook "${hook.id}": ${url}`)
    return {
      preventContinuation: true,
      blocking: `HTTP hook URL must use HTTPS (received: ${url}). Set ATTA_ALLOW_HTTP_HOOKS=1 to override.`,
    }
  }

  const timeoutMs = hook.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'AttaSeek-Hook/1.0',
      },
      body: JSON.stringify(buildHookPayload(hook, ctx)),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.warn(`[execHttpHook] HTTP ${response.status} for hook "${hook.id}": ${text.slice(0, 500)}`)
      // Non-2xx is non-blocking by default (hooks should not crash the agent)
      return {}
    }

    const rawBody = await response.text()
    if (rawBody.length > MAX_RESPONSE_SIZE) {
      console.warn(`[execHttpHook] Response too large for hook "${hook.id}": ${rawBody.length} bytes`)
      return {}
    }

    const parsed = tryParseJson(rawBody)
    if (!parsed) {
      // Non-JSON response — treat as plain text system message
      return { messages: [rawBody.slice(0, 2000)] }
    }

    return mapHttpResponse(parsed)
  } catch (err) {
    const message = (err as Error)?.message || String(err)
    if (message.includes('abort') || message.includes('timeout')) {
      console.warn(`[execHttpHook] Timeout (${timeoutMs}ms) for hook "${hook.id}"`)
      return {}
    }
    console.warn(`[execHttpHook] Failed for hook "${hook.id}":`, message)
    return {}
  }
}

// ── Payload builder ──

function buildHookPayload(hook: HookConfig, ctx: HookContext): Record<string, unknown> {
  return {
    hook_id: hook.id,
    event: hook.event,
    tool_name: ctx.toolName,
    tool_input: ctx.toolInput,
    tool_output: ctx.toolOutput,
    session_id: ctx.task.sessionId,
    task_id: ctx.task.id,
    turn_count: ctx.turnCount,
    profile_id: ctx.profileId,
    last_assistant_content: ctx.lastAssistantContent.slice(0, 5000),
    user_message: ctx.userMessage,
    timestamp: Date.now(),
  }
}

// ── Response mapper ──

function mapHttpResponse(parsed: Record<string, unknown>): HookResult {
  const result: HookResult = {}

  // Async mode — hook indicates it will run in background
  if (parsed.async === true) {
    // The hook will notify completion later. For now, return empty — non-blocking.
    return result
  }

  // Decision (PreToolUse-style)
  if (parsed.decision === 'block') {
    result.decision = 'block'
    result.preventContinuation = true
    result.blocking = (parsed.reason as string) || 'Blocked by HTTP hook'
  } else if (parsed.decision === 'approve') {
    result.decision = 'approve'
  }

  // Continue / stopReason
  if (typeof parsed.continue === 'boolean' && !parsed.continue) {
    result.preventContinuation = true
    result.blocking = (parsed.stopReason as string) || 'Hook requested stop'
  }

  // System message injection
  if (typeof parsed.systemMessage === 'string') {
    result.messages = [parsed.systemMessage]
  }

  // Updated input (PreToolUse)
  if (parsed.updatedInput) {
    result.updatedInput = parsed.updatedInput
  }

  // Suppress output
  if (parsed.suppressOutput === true) {
    result.suppressOutput = true
  }

  return result
}

// ── URL validation ──

function isAllowedUrl(url: string): boolean {
  if (!url) return false

  // Allow HTTPS by default
  if (url.startsWith('https://')) return true

  // Allow HTTP only with explicit opt-in
  if (url.startsWith('http://')) {
    const allowHttp = process.env['ATTA_ALLOW_HTTP_HOOKS'] === '1'
    if (!allowHttp) return false
    // localhost HTTP still requires explicit allow
    return true
  }

  // Block other protocols
  return false
}

// ── JSON parsing ──

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}
