/**
 * Plan Mode tool implementations — enter_plan_mode and exit_plan_mode.
 * Plan mode state is per-session (keyed by sessionId), avoiding cross-session leaks.
 */

import type { ToolExecContext } from '../../../tools/ToolImplementations'

const planModeSessions = new Set<string>()

export function isPlanModeActive(sessionId?: string): boolean {
  return sessionId ? planModeSessions.has(sessionId) : planModeSessions.size > 0
}

export const enterPlanModeImpl = {
  toolId: 'enter_plan_mode',
  execute: async (input: Record<string, unknown>, ctx?: ToolExecContext) => {
    const sid = ctx?.sessionId || 'default'
    if (planModeSessions.has(sid)) return 'Already in plan mode. Create your plan now.'
    planModeSessions.add(sid)
    const desc = String(input.description || '')
    return [
      'Entered plan mode.',
      desc ? `Planning: ${desc}` : '',
      '',
      'You are now in plan mode. Create a structured implementation plan:',
      '1. Analyze the task requirements',
      '2. Identify affected files and components',
      '3. Design the implementation approach',
      '4. Present the plan as a TaskPlan for user approval',
      '',
      'Use exit_plan_mode when the user approves the plan.',
    ].filter(Boolean).join('\n')
  },
}

export const exitPlanModeImpl = {
  toolId: 'exit_plan_mode',
  execute: async (input: Record<string, unknown>, ctx?: ToolExecContext) => {
    const sid = ctx?.sessionId || 'default'
    if (!planModeSessions.has(sid)) return 'Not in plan mode.'
    planModeSessions.delete(sid)
    const planSummary = String(input.plan_summary || 'Plan approved')
    return `Exited plan mode. Plan: ${planSummary}\n\nProceed with implementation step by step.`
  },
}

