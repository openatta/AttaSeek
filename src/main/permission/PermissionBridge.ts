/**
 * PermissionBridge — Promise-based bridge for blocking permission requests.
 *
 * When ToolExecutor encounters an 'ask' permission decision, it calls
 * awaitPermission() which returns a Promise that resolves when the
 * renderer sends its decision via permission:respond IPC.
 *
 * This is the mechanism that lets the agent loop pause until the user
 * clicks Allow or Deny in the PermissionRequestedEvent UI.
 */

import type { PermissionDecision } from '../../renderer/core/types/Permission'

interface PendingRequest {
  resolve: (decision: 'allow' | 'deny') => void
  timer: NodeJS.Timeout
}

export class PermissionBridge {
  private pending = new Map<string, PendingRequest>()
  private defaultTimeoutMs: number

  constructor(defaultTimeoutMs = 120_000) {
    this.defaultTimeoutMs = defaultTimeoutMs
  }

  /**
   * Wait for the renderer to respond to a permission request.
   * Returns a Promise that resolves with 'allow' or 'deny'.
   * Times out after `timeoutMs` (default 120s), defaulting to 'deny'.
   */
  awaitPermission(requestId: string, timeoutMs?: number): Promise<'allow' | 'deny'> {
    const ms = timeoutMs || this.defaultTimeoutMs

    return new Promise<'allow' | 'deny'>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        console.warn(`[PermissionBridge] request ${requestId} timed out — defaulting to deny`)
        resolve('deny')
      }, ms)

      this.pending.set(requestId, { resolve, timer })
    })
  }

  /**
   * Resolve a pending permission request.
   * Called by the permission:respond IPC handler when the renderer sends its decision.
   */
  resolve(requestId: string, decision: 'allow' | 'deny'): boolean {
    const pending = this.pending.get(requestId)
    if (!pending) {
      console.warn(`[PermissionBridge] no pending request for ${requestId}`)
      return false
    }

    clearTimeout(pending.timer)
    this.pending.delete(requestId)
    pending.resolve(decision)
    return true
  }

  /** Cancel all pending requests (e.g., on app shutdown) */
  cancelAll(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.resolve('deny')
    }
    this.pending.clear()
  }
}

/** Singleton */
export const permissionBridge = new PermissionBridge()
