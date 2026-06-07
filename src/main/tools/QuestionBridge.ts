/**
 * QuestionBridge — Promise-based bridge for blocking user questions.
 *
 * When AskUserQuestionTool needs user input, it calls awaitAnswer() which
 * returns a Promise that resolves when the renderer sends the answer via
 * question:respond IPC.
 *
 * Pattern paralleled with PermissionBridge — same await/resolve mechanism.
 */

interface PendingQuestion {
  resolve: (answer: string) => void
  timer: NodeJS.Timeout
}

export class QuestionBridge {
  private pending = new Map<string, PendingQuestion>()
  private defaultTimeoutMs: number

  constructor(defaultTimeoutMs = 300_000) {
    this.defaultTimeoutMs = defaultTimeoutMs
  }

  /**
   * Wait for the renderer to respond to a user question.
   * Returns a Promise that resolves with the user's answer string.
   * Times out after `timeoutMs` (default 5 min), resolving with '[no answer]'.
   */
  awaitAnswer(questionId: string, timeoutMs?: number): Promise<string> {
    const ms = timeoutMs || this.defaultTimeoutMs

    return new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(questionId)
        console.warn(`[QuestionBridge] question ${questionId} timed out`)
        resolve('[no answer]')
      }, ms)

      this.pending.set(questionId, { resolve, timer })
    })
  }

  /**
   * Resolve a pending question.
   * Called by the question:respond IPC handler when the user submits an answer.
   */
  resolve(questionId: string, answer: string): boolean {
    const pending = this.pending.get(questionId)
    if (!pending) {
      console.warn(`[QuestionBridge] no pending question for ${questionId}`)
      return false
    }

    clearTimeout(pending.timer)
    this.pending.delete(questionId)
    pending.resolve(answer)
    return true
  }

  /** Cancel all pending questions (e.g., on app shutdown) */
  cancelAll(): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.resolve('[cancelled]')
    }
    this.pending.clear()
  }
}

/** Singleton */
export const questionBridge = new QuestionBridge()
