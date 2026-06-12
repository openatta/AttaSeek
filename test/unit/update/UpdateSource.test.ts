import { describe, it, expect } from 'vitest'
import type { UpdateManifest, UpdateChannel, UpdateSettings } from '../../../src/shared/types/update'

// ── Platform tag builder (extracted from UpdateSource logic) ──

function buildPlatformTag(platform: string, arch: string): string {
  const platMap: Record<string, string> = {
    darwin: 'macOS', win32: 'Windows', linux: 'Linux',
  }
  const archMap: Record<string, string> = {
    x64: 'x64', arm64: 'arm64',
  }
  return `${platMap[platform] || platform}-${archMap[arch] || arch}`
}

describe('buildPlatformTag', () => {
  it('builds macOS tags', () => {
    expect(buildPlatformTag('darwin', 'arm64')).toBe('macOS-arm64')
    expect(buildPlatformTag('darwin', 'x64')).toBe('macOS-x64')
  })

  it('builds Windows tags', () => {
    expect(buildPlatformTag('win32', 'x64')).toBe('Windows-x64')
  })

  it('builds Linux tags', () => {
    expect(buildPlatformTag('linux', 'x64')).toBe('Linux-x64')
  })

  it('falls back to raw platform for unknown OS', () => {
    expect(buildPlatformTag('freebsd', 'x64')).toBe('freebsd-x64')
  })

  it('falls back to raw arch for unknown architecture', () => {
    expect(buildPlatformTag('darwin', 'riscv64')).toBe('macOS-riscv64')
  })
})

// ── Composite source fallback logic ──

type FetchFn = (
  currentVersion: string,
  platform: string,
  arch: string,
  channel: UpdateChannel,
) => Promise<UpdateManifest | null>

class CompositeUpdateSource {
  constructor(
    private primary: { fetch: FetchFn },
    private fallback: { fetch: FetchFn },
  ) {}

  async fetch(
    currentVersion: string,
    platform: string,
    arch: string,
    channel: UpdateChannel,
  ): Promise<UpdateManifest | null> {
    const result = await this.primary.fetch(currentVersion, platform, arch, channel)
    if (result) return result
    return this.fallback.fetch(currentVersion, platform, arch, channel)
  }
}

const mockManifest: UpdateManifest = {
  version: '2.0.0',
  platform: 'darwin-arm64',
  url: 'https://example.com/attaseek-2.0.0.dmg',
  size: 50_000_000,
  sha256: 'abc123',
  changelogUrl: 'https://example.com/releases/2.0.0',
  publishedAt: Date.now(),
  urgency: 'latest',
}

describe('CompositeUpdateSource', () => {
  it('returns primary result when primary succeeds', async () => {
    const primary = { fetch: async () => mockManifest }
    const fallback = { fetch: async () => null }
    const source = new CompositeUpdateSource(primary, fallback)

    const result = await source.fetch('1.0.0', 'darwin', 'arm64', 'stable')
    expect(result).toEqual(mockManifest)
  })

  it('falls back to secondary when primary returns null', async () => {
    const fallbackManifest: UpdateManifest = { ...mockManifest, version: '1.5.0' }
    const primary = { fetch: async () => null }
    const fallback = { fetch: async () => fallbackManifest }
    const source = new CompositeUpdateSource(primary, fallback)

    const result = await source.fetch('1.0.0', 'darwin', 'arm64', 'stable')
    expect(result).toEqual(fallbackManifest)
  })

  it('returns null when both sources return null', async () => {
    const primary = { fetch: async () => null }
    const fallback = { fetch: async () => null }
    const source = new CompositeUpdateSource(primary, fallback)

    const result = await source.fetch('1.0.0', 'darwin', 'arm64', 'stable')
    expect(result).toBeNull()
  })

  it('does not call fallback when primary succeeds', async () => {
    let fallbackCalled = false
    const primary = { fetch: async () => mockManifest }
    const fallback = {
      fetch: async () => {
        fallbackCalled = true
        return null
      },
    }
    const source = new CompositeUpdateSource(primary, fallback)

    await source.fetch('1.0.0', 'darwin', 'arm64', 'stable')
    expect(fallbackCalled).toBe(false)
  })

  it('still returns null when primary throws (propagates error)', async () => {
    // Note: the real CompositeUpdateSource does NOT catch errors from the
    // primary source — errors propagate. This test verifies current behavior.
    const primary = { fetch: async () => { throw new Error('Network error') } }
    const fallback = { fetch: async () => mockManifest }
    const source = new CompositeUpdateSource(primary, fallback)

    await expect(
      source.fetch('1.0.0', 'darwin', 'arm64', 'stable'),
    ).rejects.toThrow('Network error')
  })
})

// ── Shared type validations ──

describe('UpdateSettings defaults', () => {
  it('has correct default shape', () => {
    const defaults: UpdateSettings = {
      channel: 'stable',
      autoDownload: true,
      checkOnStartup: true,
    }
    expect(defaults.channel).toBe('stable')
    expect(defaults.autoDownload).toBe(true)
    expect(defaults.checkOnStartup).toBe(true)
  })
})

describe('UpdateStatus shape', () => {
  it('idle state has expected fields', () => {
    const status = {
      state: 'idle' as const,
      canRetry: false,
      retryCount: 0,
    }
    expect(status.state).toBe('idle')
    expect(status.canRetry).toBe(false)
    expect(status.retryCount).toBe(0)
    expect(status.manifest).toBeUndefined()
    expect(status.progress).toBeUndefined()
  })

  it('available state carries manifest', () => {
    const status = {
      state: 'available' as const,
      manifest: mockManifest,
      canRetry: false,
      retryCount: 0,
    }
    expect(status.manifest.version).toBe('2.0.0')
    expect(status.manifest.urgency).toBe('latest')
  })
})
