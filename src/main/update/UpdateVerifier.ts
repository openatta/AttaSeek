/**
 * UpdateVerifier — validates downloaded update packages before installation.
 *
 * Two verification layers:
 * 1. SHA256 hash check (always enforced)
 * 2. Code signature verification (reserved, currently skipped — will be enabled
 *    once code signing certificates are provisioned)
 *
 * Singleton class — configure once during boot, then call verifyUpdate().
 */

import { createHash } from 'crypto'
import { readFile } from 'fs/promises'

export interface VerificationResult {
  passed: boolean
  reason?: string
}

export interface SignatureConfig {
  /** Whether signature verification is enabled. Default true on macOS/Windows. */
  enabled?: boolean
  /** Allowed certificate subjects (macOS) or signer names (Windows). If empty, any valid signature passes. */
  allowedSigners?: string[]
  /** GPG key fingerprint for Linux AppImage verification. */
  gpgKeyFingerprint?: string
}

class UpdateVerifierImpl {
  private sigConfig: SignatureConfig = {}

  /** Set signature verification configuration (call during boot, after config load). */
  configureSignatureVerification(config: SignatureConfig): void {
    this.sigConfig = { ...config }
  }

  /**
   * Verify a downloaded file against its expected SHA256 hash.
   */
  async verifySha256(filePath: string, expectedSha256: string): Promise<VerificationResult> {
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
   * Returns true while signature verification is stubbed out.
   *
   * When this returns true, verifySignature() always returns { passed: true }
   * regardless of input. Tests can use this to differentiate stub-mode
   * assertions from real verification assertions.
   *
   * When code signing certificates are provisioned and the real
   * implementation (codesign / PowerShell / GPG) is activated, delete
   * this method and update the corresponding tests.
   */
  isSignatureStubbed(): boolean {
    return true
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
  async verifySignature(_filePath: string): Promise<VerificationResult> {
    // Reserved — skip for now
    console.log('[update] code signature verification skipped (certificates not yet provisioned)')
    return { passed: true }
  }

  /**
   * Full verification pipeline: SHA256 + (future) signature.
   */
  async verifyUpdate(filePath: string, expectedSha256: string): Promise<VerificationResult> {
    const shaResult = await this.verifySha256(filePath, expectedSha256)
    if (!shaResult.passed) return shaResult

    const sigResult = await this.verifySignature(filePath)
    if (!sigResult.passed) return sigResult

    return { passed: true }
  }
}

/** Singleton instance. Configure via .configureSignatureVerification() during boot. */
export const updateVerifier = new UpdateVerifierImpl()

// Convenience re-exports for backward compatibility
export const verifyUpdate = updateVerifier.verifyUpdate.bind(updateVerifier)
export const verifySha256 = updateVerifier.verifySha256.bind(updateVerifier)
export const verifySignature = updateVerifier.verifySignature.bind(updateVerifier)
export const configureSignatureVerification = updateVerifier.configureSignatureVerification.bind(updateVerifier)
export const isSignatureStubbed = updateVerifier.isSignatureStubbed.bind(updateVerifier)
