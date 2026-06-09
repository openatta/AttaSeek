/**
 * HookPipeline — event-driven hook execution pipeline.
 *
 * Fires hooks in priority order when matching events occur.
 * Supports 'callback', 'command', and 'prompt' hook types.
 *
 * This is the EVENT dispatcher — the existing HookManager remains
 * as the PostSampling-specific pipeline.
 */

import type { HookEventType, HookConfig, HookContext, HookResult } from './HookTypes'

export class HookPipeline {
  private hooks: HookConfig[] = []

  register(hook: HookConfig): void {
    this.hooks.push(hook)
    this.hooks.sort((a, b) => a.priority - b.priority)
  }

  unregister(id: string): void {
    this.hooks = this.hooks.filter(h => h.id !== id)
  }

  /** Get hooks matching an event type (optionally filtered by tool name) */
  getMatching(eventType: HookEventType, toolName?: string): HookConfig[] {
    return this.hooks.filter(h => {
      if (!h.enabled) return false
      if (h.event !== eventType) return false
      if (toolName && h.matcher) {
        return matchPattern(toolName, h.matcher.pattern)
      }
      return true
    })
  }

  /** Execute all matching hooks for an event */
  async execute(eventType: HookEventType, ctx: HookContext): Promise<HookResult> {
    const result: HookResult = { messages: [] }
    const matched = this.getMatching(eventType, ctx.toolName)

    for (const hook of matched) {
      try {
        let hookResult: HookResult | null = null

        switch (hook.type) {
          case 'callback':
            // Callbacks are registered separately via HookManager
            // This path handles config-based hooks only
            break
          case 'command':
            hookResult = await executeCommandHook(hook, ctx)
            break
          case 'prompt':
            hookResult = await executePromptHook(hook, ctx)
            break
          case 'http':
            hookResult = await executeHttpHook(hook, ctx)
            break
        }

        if (hookResult) {
          if (hookResult.messages) result.messages!.push(...hookResult.messages)
          if (hookResult.preventContinuation) {
            result.preventContinuation = true
            result.blocking = hookResult.blocking
            return result
          }
          if (hookResult.suppressOutput) result.suppressOutput = true
          if (hookResult.updatedInput) result.updatedInput = hookResult.updatedInput
          if (hookResult.decision) result.decision = hookResult.decision
        }
      } catch (err) {
        console.warn(`[HookPipeline] hook "${hook.id}" failed:`, err)
      }
    }

    return result
  }

  list(): HookConfig[] { return [...this.hooks] }
}

// ── Pattern matching ──

function matchPattern(name: string, pattern: string): boolean {
  if (!pattern) return true
  // Exact match
  if (name === pattern) return true
  // Pipe-separated alternatives
  if (pattern.includes('|')) {
    return pattern.split('|').some(p => matchPattern(name, p.trim()))
  }
  // Glob-style wildcard: Bash(git *)
  if (pattern.includes('*')) {
    const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    return re.test(name)
  }
  return false
}

// ── Hook executors ──

async function executeCommandHook(hook: HookConfig, ctx: HookContext): Promise<HookResult> {
  const { execCommandHook } = await import('./execCommandHook')
  return execCommandHook(hook, ctx)
}

async function executePromptHook(hook: HookConfig, ctx: HookContext): Promise<HookResult> {
  const { execPromptHook } = await import('./execPromptHook')
  return execPromptHook(hook, ctx)
}

async function executeHttpHook(hook: HookConfig, ctx: HookContext): Promise<HookResult> {
  const { execHttpHook } = await import('./execHttpHook')
  return execHttpHook(hook, ctx)
}

export const hookPipeline = new HookPipeline()
