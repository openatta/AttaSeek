/**
 * Tests for update-related pure functions.
 *
 * Tests the shared version utilities (src/main/update/version-utils.ts)
 * which are the single source of truth used by both UpdateManager and
 * any other code that needs version comparison.
 */

import { describe, it, expect } from 'vitest'
import { parseVersion, toChannel, isNewer } from '../../../src/main/update/version-utils'

describe('parseVersion (version comparison)', () => {
  it('parses a simple major.minor.patch', () => {
    expect(parseVersion('1.2.3')).toBe(1_002_003)
  })

  it('parses major-only version', () => {
    expect(parseVersion('2')).toBe(2_000_000)
  })

  it('parses major.minor without patch', () => {
    expect(parseVersion('2.5')).toBe(2_005_000)
  })

  it('orders correctly: patch bump', () => {
    expect(parseVersion('1.0.1')).toBeGreaterThan(parseVersion('1.0.0'))
  })

  it('orders correctly: minor bump', () => {
    expect(parseVersion('1.1.0')).toBeGreaterThan(parseVersion('1.0.9'))
  })

  it('orders correctly: major bump', () => {
    expect(parseVersion('2.0.0')).toBeGreaterThan(parseVersion('1.99.99'))
  })

  it('handles zero versions', () => {
    expect(parseVersion('0.0.0')).toBe(0)
    expect(parseVersion('0.0.1')).toBe(1)
  })

  it('handles large version numbers without overflow', () => {
    // Major up to 999 fits within Number.MAX_SAFE_INTEGER for the combined value
    const v = parseVersion('999.999.999')
    expect(v).toBe(999_999_999)
    expect(Number.isSafeInteger(v)).toBe(true)
  })

  it('parses non-numeric parts as NaN and propagates', () => {
    const result = parseVersion('abc.def.ghi')
    expect(Number.isNaN(result)).toBe(true)
  })
})

// ── Channel mapping ──

describe('toChannel', () => {
  it('returns "stable" for missing/unknown input', () => {
    expect(toChannel('')).toBe('stable')
    expect(toChannel('alpha')).toBe('stable')
    expect(toChannel('canary')).toBe('stable')
  })

  it('returns "beta" for "beta"', () => {
    expect(toChannel('beta')).toBe('beta')
  })

  it('returns "nightly" for "nightly"', () => {
    expect(toChannel('nightly')).toBe('nightly')
  })

  it('returns "stable" for "stable"', () => {
    expect(toChannel('stable')).toBe('stable')
  })
})

// ── isNewer logic ──

describe('isNewer', () => {
  it('returns true for a newer version', () => {
    expect(isNewer('2.0.0', '1.0.0')).toBe(true)
  })

  it('returns false for same version', () => {
    expect(isNewer('1.0.0', '1.0.0')).toBe(false)
  })

  it('returns false for older version', () => {
    expect(isNewer('0.9.0', '1.0.0')).toBe(false)
  })

  it('handles missing patch components', () => {
    expect(isNewer('1.1', '1.0.9')).toBe(true)
  })
})
