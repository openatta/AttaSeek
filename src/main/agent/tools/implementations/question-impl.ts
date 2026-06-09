/**
 * AskUserQuestionTool — block until the user provides an answer.
 * Uses QuestionBridge (Promise-based await/resolve) — same pattern as PermissionBridge.
 */

import { questionBridge } from '../../../tools/QuestionBridge'
import { agentEventBus } from '../../../agent/AgentEventBus'
import { hookPipeline } from '../../hooks/HookPipeline'
import { newId } from '../../../store/id'
import type { ToolExecContext } from '../../../tools/ToolImplementations'

export const askUserQuestionImpl = {
  toolId: 'ask_user_question',
  execute: async (input: Record<string, unknown>, ctx?: ToolExecContext) => {
    const question = String(input.question || '')
    if (!question) throw new Error('question is required')
    const options = Array.isArray(input.options) ? (input.options as string[]) : undefined

    const questionId = `q_${newId().slice(0, 8)}`

    // Run Elicitation hooks — allow hooks to observe/modify the question before showing to user
    try {
      hookPipeline.execute('Elicitation', {
        task: {
          id: ctx?.taskId || 'unknown',
          sessionId: ctx?.sessionId || 'default',
          projectId: undefined,
          goal: '',
          status: 'idle',
          createdAt: 0,
          updatedAt: 0,
        },
        turnCount: 0,
        messages: [],
        lastAssistantContent: '',
        profileId: 'default',
        elicitationQuestion: question,
        elicitationOptions: options,
      })
    } catch { /* hook failure is non-blocking */ }

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

    // Run Elicitation hook after response — hooks can observe the user's answer
    try {
      hookPipeline.execute('Elicitation', {
        task: {
          id: ctx?.taskId || 'unknown',
          sessionId: ctx?.sessionId || 'default',
          projectId: undefined,
          goal: '',
          status: 'idle',
          createdAt: 0,
          updatedAt: 0,
        },
        turnCount: 0,
        messages: [],
        lastAssistantContent: '',
        profileId: 'default',
        elicitationQuestion: question,
        elicitationOptions: options,
        elicitationResponse: answer,
      })
    } catch { /* hook failure is non-blocking */ }

    return `User answered: ${answer}`
  },
}
