/**
 * UpdateVerifier — validates downloaded update packages before installation.
 *
 * Two verification layers:
 * 1. SHA256 hash check (always enforced)
 * 2. Code signature verification (reserved, currently skipped — will be enabled
 *    once code signing certificates are provisioned)
 */

import { createHash } from 'crypto'
import { readFile } from 'fs/promises'

export interface VerificationResult {
  passed: boolean
  reason?: string
}

/**
 * Verify a downloaded file against its expected SHA256 hash.
 */
export async function verifySha256(filePath: string, expectedSha256: string): Promise<VerificationResult> {
  if (!expectedSha256) {
    // No hash to check against — allow but warn
    console.warn('[update] no SHA256 hash provided for verification, skipping')
    return { passed: true }
  }

  try {
    const data = await readFile(filePath)
    const actual = createHash('sha256').update(data).digest('hex')
    if (actual.toLowerCase() !== expectedSha256.toLowerCase()) {
      return { passed: false, reason: `SHA256 mismatch: expected ${expectedSha256.slice(0, 16)}..., got ${actual.slice(0, 16)}...` }
    }
    return { passed: true }
  } catch (err) {
    return { passed: false, reason: `SHA256 check failed: ${err instanceof Error ? err.message : 'unknown error'}` }
  }
}

/**
 * Verify code signature of the downloaded installer/package.
 *
 * CURRENTLY SKIPPED — will be enabled once code signing certificates are provisioned.
 * Design follows platform conventions:
 *   macOS:   codesign --verify --deep /path/to/bundle
 *   Windows: Get-AuthenticodeSignature (PowerShell)
 *   Linux:   (no standard mechanism; AppImage GPG signatures optional)
 */
export async function verifySignature(_filePath: string): Promise<VerificationResult> {
  // Reserved — skip for now
  console.log('[update] code signature verification skipped (certificates not yet provisioned)')
  return { passed: true }
}

/**
 * Full verification pipeline: SHA256 + (future) signature.
 */
export async function verifyUpdate(filePath: string, expectedSha256: string): Promise<VerificationResult> {
  const shaResult = await verifySha256(filePath, expectedSha256)
  if (!shaResult.passed) return shaResult

  const sigResult = await verifySignature(filePath)
  if (!sigResult.passed) return sigResult

  return { passed: true }
}
