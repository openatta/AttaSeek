/**
 * Version comparison and channel mapping utilities.
 *
 * Pure functions — no side effects or dependencies. Shared between
 * UpdateManager and tests to avoid logic duplication.
 */

import type { UpdateChannel } from '../../shared/types/update'

/**
 * Parse a semver-ish string into a comparable integer.
 * major * 1_000_000 + minor * 1_000 + patch.
 * Non-numeric parts produce NaN (caller should guard).
 */
export function parseVersion(v: string): number {
  const parts = v.split('.').map(Number)
  return parts[0] * 1_000_000 + (parts[1] || 0) * 1_000 + (parts[2] || 0)
}

/** Returns true if `newVersion` is strictly greater than `current`. */
export function isNewer(newVersion: string, current: string): boolean {
  return parseVersion(newVersion) > parseVersion(current)
}

/** Normalize a raw persisted channel string into a typed UpdateChannel. */
export function toChannel(raw: string): UpdateChannel {
  if (raw === 'beta') return 'beta'
  if (raw === 'nightly') return 'nightly'
  return 'stable'
}
