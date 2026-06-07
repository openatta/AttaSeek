/**
 * execPromptHook — executes an LLM-based prompt hook.
 *
 * Makes a sub-call to the LLM with the hook's prompt as system instruction.
 * Used for classification, validation, and analysis hooks.
 */

import type { HookConfig, HookContext, HookResult } from './HookTypes'

export async function execPromptHook(
  hook: HookConfig,
  ctx: HookContext,
): Promise<HookResult> {
  if (!hook.prompt) return {}

  try {
    // Build context for the prompt hook
    const contextLines = [
      `Last assistant content (truncated): ${ctx.lastAssistantContent.slice(0, 500)}`,
      `Turn count: ${ctx.turnCount}`,
      ctx.toolName ? `Tool: ${ctx.toolName}` : '',
      ctx.userMessage ? `User message: ${ctx.userMessage}` : '',
    ].filter(Boolean).join('\n')

    const fullPrompt = `${hook.prompt}\n\nContext:\n${contextLines}`

    // For now, return the prompt as a structured instruction.
    // Full LLM sub-call integration requires access to the provider,
    // which will be threaded through the HookContext in a future iteration.
    return {
      messages: [`[Prompt hook: ${hook.id}] Instruction: ${fullPrompt.slice(0, 1000)}`],
    }
  } catch (err) {
    console.warn(`[execPromptHook] hook "${hook.id}" failed:`, err)
    return {}
  }
}
