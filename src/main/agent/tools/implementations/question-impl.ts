/**
 * AskUserQuestionTool — block until the user provides an answer.
 * Uses QuestionBridge (Promise-based await/resolve) — same pattern as PermissionBridge.
 */

import { questionBridge } from '../../../tools/QuestionBridge'
import { agentEventBus } from '../../../agent/AgentEventBus'
import { newId } from '../../../store/id'
import type { ToolExecContext } from '../../../tools/ToolImplementations'

export const askUserQuestionImpl = {
  toolId: 'ask_user_question',
  execute: async (input: Record<string, unknown>, ctx?: ToolExecContext) => {
    const question = String(input.question || '')
    if (!question) throw new Error('question is required')
    const options = Array.isArray(input.options) ? (input.options as string[]) : undefined

    const questionId = `q_${newId().slice(0, 8)}`

    // Emit event for renderer to display the question UI
    agentEventBus.emit({
      id: newId(),
      sessionId: ctx?.sessionId || 'default',
      taskId: ctx?.taskId || 'unknown',
      type: 'UserQuestion',
      payload: { questionId, question, options },
      createdAt: Date.now(),
    })

    // Block until user responds via IPC
    const answer = await questionBridge.awaitAnswer(questionId)
    return `User answered: ${answer}`
  },
}
