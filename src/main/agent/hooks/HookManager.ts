/**
 * Hook types and HookManager for Post-Sampling Hooks system.
 *
 * Hooks execute after each LLM response, before the next turn.
 * Pipeline: confidence → coaching → brief → memory (priority order).
 */

import type { LLMMessage } from '../llm/LLMProvider'
import type { AgentTask } from '../../../shared/types/AgentTask'

export interface HookContext {
  task: AgentTask
  turnCount: number
  messages: LLMMessage[]
  lastAssistantContent: string
  profileId: string
}

export interface HookResult {
  /** Messages to inject into the next turn's system prompt */
  messages?: string[]
  /** Prevent the agent from continuing (blocking error) */
  preventContinuation?: boolean
  /** Reason for blocking */
  blocking?: string
}

export interface PostSamplingHook {
  name: string
  priority: number
  /** When to trigger: every turn, first turn only, every N turns, on error */
  trigger: 'every' | 'first' | 'interval' | 'on_error'
  /** Interval for 'interval' trigger (every N turns) */
  interval?: number
  execute: (ctx: HookContext) => Promise<HookResult>
}

export class HookManager {
  private hooks: PostSamplingHook[] = []

  register(hook: PostSamplingHook): void {
    this.hooks.push(hook)
    this.hooks.sort((a, b) => a.priority - b.priority)
  }

  unregister(name: string): void {
    this.hooks = this.hooks.filter(h => h.name !== name)
  }

  /** Execute all hooks whose trigger condition matches */
  async execute(ctx: HookContext): Promise<HookResult> {
    const results: HookResult = { messages: [] }

    for (const hook of this.hooks) {
      if (!this.shouldTrigger(hook, ctx)) continue
      try {
        const result = await hook.execute(ctx)
        if (result.messages) results.messages!.push(...result.messages)
        if (result.preventContinuation) {
          results.preventContinuation = true
          results.blocking = result.blocking
          break // stop the pipeline
        }
      } catch (err) {
        console.warn(`[HookManager] hook "${hook.name}" failed:`, err)
        // Hook failure is non-blocking — continue pipeline
      }
    }

    return results
  }

  private shouldTrigger(hook: PostSamplingHook, ctx: HookContext): boolean {
    switch (hook.trigger) {
      case 'every': return true
      case 'first': return ctx.turnCount === 1
      case 'interval': return ctx.turnCount % (hook.interval || 3) === 0
      case 'on_error': return ctx.lastAssistantContent.length === 0 // trigger on empty/error response
      default: return false
    }
  }

  list(): PostSamplingHook[] { return [...this.hooks] }
}

export const hookManager = new HookManager()
