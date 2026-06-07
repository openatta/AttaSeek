/**
 * RecursionGuard — prevents nested sub-agent forking.
 *
 * When a sub-agent tries to spawn another sub-agent, the fork is rejected.
 * This matches Claude Code's isInForkChild check in forkSubagent.ts.
 */

export class RecursionGuard {
  private depth = 0
  private maxDepth: number

  constructor(maxDepth = 1) {
    this.maxDepth = maxDepth
  }

  /** Enter a fork context. Returns false and an error message if at max depth. */
  enter(contextId: string): { allowed: boolean; message?: string } {
    if (this.depth >= this.maxDepth) {
      return {
        allowed: false,
        message: `Cannot fork sub-agent "${contextId}": already inside a sub-agent (max depth ${this.maxDepth})`,
      }
    }
    this.depth++
    return { allowed: true }
  }

  /** Exit a fork context. */
  exit(): void {
    if (this.depth > 0) this.depth--
  }

  /** Whether currently inside a fork */
  get isInFork(): boolean {
    return this.depth > 0
  }

  /** Current nesting depth */
  get currentDepth(): number {
    return this.depth
  }
}

export const recursionGuard = new RecursionGuard()
