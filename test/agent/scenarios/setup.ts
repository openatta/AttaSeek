/**
 * Test setup utilities — temporary directories, file fixtures, profile loading.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { testProfile } from '../fixtures/profiles/test-profile'
import { codingProfile } from '../../../src/main/agent/profile/profiles/coding-profile'
import type { AgentProfile } from '../../../src/main/agent/profile/AgentProfile'

export interface TestEnv {
  tempDir: string
  profile: AgentProfile
  cleanup: () => void
}

/** Create a temp directory with optional guest files */
export function setupTempDir(guestFiles?: Record<string, string>): TestEnv {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'attaseek-test-'))

  if (guestFiles) {
    for (const [filePath, content] of Object.entries(guestFiles)) {
      const fullPath = path.join(tempDir, filePath)
      const dir = path.dirname(fullPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(fullPath, content, 'utf-8')
    }
  }

  return {
    tempDir,
    profile: { ...testProfile },
    cleanup: () => {
      try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch { /* ignore */ }
    },
  }
}

/** Load a profile by name */
export function loadProfile(name: string): AgentProfile {
  switch (name) {
    case 'coding': return codingProfile
    case 'test':
    default: return testProfile
  }
}
