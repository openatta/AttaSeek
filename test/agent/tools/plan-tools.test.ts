/**
 * Plan mode tools — unit tests for enter_plan_mode and exit_plan_mode.
 */

import { describe, it, expect } from 'vitest'
import { enterPlanModeImpl, exitPlanModeImpl, isPlanModeActive } from '../../../src/main/agent/tools/implementations/plan-impl'

describe('Plan mode tools', () => {
  it('should enter plan mode for a session', async () => {
    const ctx = { taskId: 't1', sessionId: 's1' }
    const result = await enterPlanModeImpl.execute({ description: 'Design auth' }, ctx)
    expect(typeof result).toBe('string')
    expect(result as string).toContain('Entered plan mode')
    expect(isPlanModeActive('s1')).toBe(true)
  })

  it('should not enter plan mode twice for same session', async () => {
    const ctx = { taskId: 't2', sessionId: 's2' }
    await enterPlanModeImpl.execute({}, ctx)
    const result = await enterPlanModeImpl.execute({}, ctx)
    expect(result as string).toContain('Already in plan mode')
  })

  it('should exit plan mode', async () => {
    const ctx = { taskId: 't3', sessionId: 's3' }
    await enterPlanModeImpl.execute({}, ctx)
    const result = await exitPlanModeImpl.execute({ plan_summary: 'Done' }, ctx)
    expect(result as string).toContain('Exited plan mode')
    expect(isPlanModeActive('s3')).toBe(false)
  })

  it('should not exit plan mode if not active', async () => {
    const ctx = { taskId: 't4', sessionId: 's4' }
    const result = await exitPlanModeImpl.execute({ plan_summary: 'Done' }, ctx)
    expect(result as string).toContain('Not in plan mode')
  })

  it('should isolate plan mode across sessions', async () => {
    await enterPlanModeImpl.execute({}, { taskId: 'a', sessionId: 'sa' })
    expect(isPlanModeActive('sa')).toBe(true)
    expect(isPlanModeActive('sb')).toBe(false)
  })
})
