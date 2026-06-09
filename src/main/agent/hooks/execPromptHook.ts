/**
 * execPromptHook — executes an LLM-based prompt hook.
 *
 * Makes a sub-call to the LLM (using the small_fast model slot)
 * with the hook's prompt as system instruction and the current
 * context as user input. Parses the JSON-structured response.
 *
 * The small_fast provider is resolved lazily from the registry.
 * Hooks that timeout or fail are non-blocking by default.
 */

import type { HookConfig, HookContext, HookResult } from './HookTypes'

const DEFAULT_TIMEOUT_MS = 5_000
const MAX_CONTEXT_CHARS = 4_000

/** Provider setter — injected by the boot sequence. */
let _providerGetter: (() => Promise<{
  chat: (params: { systemPrompt: string; messages: Array<{ role: string; content: string }>; signal?: AbortSignal; model?: string }) => Promise<{ content: string; stopReason: string; usage: { inputTokens: number; outputTokens: number } }>
}>) | null = null

/**
 * Set the provider factory for prompt hooks.
 * Called once during boot by the agent initialization sequence.
 */
export function setPromptHookProvider(
  getter: () => Promise<{
    chat: (params: { systemPrompt: string; messages: Array<{ role: string; content: string }>; signal?: AbortSignal; model?: string }) => Promise<{ content: string; stopReason: string; usage: { inputTokens: number; outputTokens: number } }>
  }>,
): void {
  _providerGetter = getter
}

export async function execPromptHook(
  hook: HookConfig,
  ctx: HookContext,
): Promise<HookResult> {
  if (!hook.prompt) return {}

  try {
    const contextStr = buildContext(ctx)

    // If no provider is wired, fall back to heuristic (non-blocking)
    if (!_providerGetter) {
      return {
        messages: [`[Prompt hook: ${hook.id}] Context: ${contextStr.slice(0, 500)}`],
      }
    }

    const timeoutMs = hook.timeoutMs || DEFAULT_TIMEOUT_MS
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const provider = await _providerGetter()
      const response = await provider.chat({
        systemPrompt: `${hook.prompt}\n\nRespond with JSON only: {"continue": true/false, "decision": "approve"|"block", "systemMessage": "optional feedback", "reason": "brief explanation"}`,
        messages: [{ role: 'user', content: contextStr }],
        signal: controller.signal,
        model: undefined, // Use provider default (small_fast slot)
      })

      clearTimeout(timeout)

      const parsed = tryParseJson(response.content)
      if (!parsed) {
        // Response wasn't valid JSON — treat as unstructured feedback
        return { messages: [response.content.slice(0, 1000)] }
      }

      return mapPromptResponse(parsed, hook.id)
    } catch (err) {
      clearTimeout(timeout)
      const msg = (err as Error)?.message || String(err)
      if (msg.includes('abort') || msg.includes('timeout')) {
        // Timeout is non-blocking — hook is best-effort
        return {}
      }
      throw err // Re-throw for HookPipeline to catch
    }
  } catch (err) {
    console.warn(`[execPromptHook] hook "${hook.id}" failed:`, err)
    return {}
  }
}

// ── Helpers ──

function buildContext(ctx: HookContext): string {
  const lines: string[] = []

  if (ctx.lastAssistantContent) {
    const truncated = ctx.lastAssistantContent.slice(0, MAX_CONTEXT_CHARS)
    lines.push(`## Last Assistant Response\n${truncated}`)
  }

  lines.push(`## Session Info`)
  lines.push(`- Turn: ${ctx.turnCount}`)
  lines.push(`- Profile: ${ctx.profileId}`)

  if (ctx.toolName) {
    lines.push(`## Current Tool`)
    lines.push(`- Name: ${ctx.toolName}`)
    if (ctx.toolInput) {
      lines.push(`- Input: ${JSON.stringify(ctx.toolInput).slice(0, 1000)}`)
    }
    if (ctx.toolOutput !== undefined) {
      lines.push(`- Output: ${JSON.stringify(ctx.toolOutput).slice(0, 1000)}`)
    }
  }

  if (ctx.userMessage) {
    lines.push(`## User Message\n${ctx.userMessage.slice(0, 1000)}`)
  }

  return lines.join('\n').slice(0, MAX_CONTEXT_CHARS)
}

function tryParseJson(text: string): Record<string, unknown> | null {
  // Try direct parse
  try {
    return JSON.parse(text)
  } catch { /* continue */ }

  // Try extracting from code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim())
    } catch { /* continue */ }
  }

  // Try extracting a JSON object from the text
  const objMatch = text.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0])
    } catch { /* continue */ }
  }

  return null
}

function mapPromptResponse(parsed: Record<string, unknown>, hookId: string): HookResult {
  const result: HookResult = {}

  if (parsed.decision === 'block') {
    result.decision = 'block'
    result.preventContinuation = true
    result.blocking = (parsed.reason as string) || `Blocked by prompt hook ${hookId}`
    return result
  }

  if (parsed.continue === false) {
    result.preventContinuation = true
    result.blocking = (parsed.reason as string) || `Prompt hook ${hookId} requested stop`
  }

  if (typeof parsed.systemMessage === 'string') {
    result.messages = [parsed.systemMessage]
  }

  if (parsed.suppressOutput === true) {
    result.suppressOutput = true
  }

  return result
}
