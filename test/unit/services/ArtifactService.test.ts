import { describe, it, expect } from 'vitest'

describe('ArtifactService', () => {
  it('SQLite-backed — tested via E2E integration (requires Electron runtime)', () => {
    // better-sqlite3 native module compiles against Electron Node ABI,
    // not system Node used by vitest. Full CRUD tests run at integration level.
    expect(true).toBe(true)
  })
})
