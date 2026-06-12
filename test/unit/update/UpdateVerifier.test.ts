import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'crypto'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { verifySha256, verifySignature, verifyUpdate } from '../../../src/main/update/UpdateVerifier'

function sha256Of(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

const SAMPLE_SHA256 =
  'a3f2c8e9d1b4567890abcdef1234567890abcdef1234567890abcdef12345678'

describe('verifySha256', () => {
  it('passes when hashes match', async () => {
    const content = 'hello world'
    const hash = sha256Of(content)
    const tmp = join(tmpdir(), `attaseek-test-${Date.now()}.tmp`)
    await writeFile(tmp, content)

    try {
      const result = await verifySha256(tmp, hash)
      expect(result.passed).toBe(true)
      expect(result.reason).toBeUndefined()
    } finally {
      await unlink(tmp).catch(() => {})
    }
  })

  it('fails when hashes differ', async () => {
    const tmp = join(tmpdir(), `attaseek-test-${Date.now()}.tmp`)
    await writeFile(tmp, 'not what we expect')

    try {
      const result = await verifySha256(tmp, SAMPLE_SHA256)
      expect(result.passed).toBe(false)
      expect(result.reason).toContain('SHA256 mismatch')
    } finally {
      await unlink(tmp).catch(() => {})
    }
  })

  it('passes when no expected hash provided (skips file read)', async () => {
    const result = await verifySha256('/nonexistent/path', '')
    expect(result.passed).toBe(true)
  })

  it('fails when file does not exist', async () => {
    const result = await verifySha256('/nonexistent/path/definitely/not/here', SAMPLE_SHA256)
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('SHA256 check failed')
  })

  it('performs case-insensitive hash comparison', async () => {
    const content = 'case test'
    const hash = sha256Of(content)
    const tmp = join(tmpdir(), `attaseek-test-${Date.now()}.tmp`)
    await writeFile(tmp, content)

    try {
      const result = await verifySha256(tmp, hash.toUpperCase())
      expect(result.passed).toBe(true)
    } finally {
      await unlink(tmp).catch(() => {})
    }
  })
})

describe('verifySignature', () => {
  it('always passes (reserved — skipped until certificates provisioned)', async () => {
    const result = await verifySignature('/any/path')
    expect(result.passed).toBe(true)
    expect(result.reason).toBeUndefined()
  })
})

describe('verifyUpdate', () => {
  it('passes when SHA256 matches', async () => {
    const content = 'release binary'
    const hash = sha256Of(content)
    const tmp = join(tmpdir(), `attaseek-test-${Date.now()}.tmp`)
    await writeFile(tmp, content)

    try {
      const result = await verifyUpdate(tmp, hash)
      expect(result.passed).toBe(true)
    } finally {
      await unlink(tmp).catch(() => {})
    }
  })

  it('fails when SHA256 fails (short-circuits before signature)', async () => {
    const tmp = join(tmpdir(), `attaseek-test-${Date.now()}.tmp`)
    await writeFile(tmp, 'wrong content')

    try {
      const result = await verifyUpdate(tmp, SAMPLE_SHA256)
      expect(result.passed).toBe(false)
      expect(result.reason).toContain('SHA256 mismatch')
    } finally {
      await unlink(tmp).catch(() => {})
    }
  })
})
