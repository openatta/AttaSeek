import { describe, it, expect } from 'vitest'
import { ModelUsageTracker } from '../../../src/main/model/ModelUsageTracker'

describe('ModelUsageTracker', () => {
  it('has the expected interface', () => {
    const tracker = new ModelUsageTracker()
    expect(typeof tracker.record).toBe('function')
    expect(typeof tracker.summary).toBe('function')
  })

  // Note: record() and summary() require Electron runtime (better-sqlite3).
  // Full integration tests run in the Electron environment.
})
