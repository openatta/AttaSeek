/**
 * MockPermissionBridge — injects permission decisions for testing.
 *
 * Pre-set decisions with setDecision(). When ToolExecutor calls
 * awaitPermission(), the mock returns immediately with the preset value.
 * No UI dependency.
 */

export type MockDecision = 'allow' | 'deny'

export class MockPermissionBridge {
  private decisions: MockDecision[] = []
  private requests: string[] = [] // captured request IDs

  setDecision(decision: MockDecision): void {
    this.decisions.push(decision)
  }

  async awaitPermission(requestId: string): Promise<MockDecision> {
    this.requests.push(requestId)
    const decision = this.decisions.shift()
    if (!decision) {
      console.warn(`[MockPermissionBridge] no decision queued for ${requestId}, defaulting to deny`)
      return 'deny'
    }
    return decision
  }

  cancelAll(): void {
    this.decisions = []
  }

  get requestCount(): number { return this.requests.length }
}
