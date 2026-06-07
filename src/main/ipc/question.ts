/**
 * IPC handlers for question:* channels.
 * Renderer sends user's answer to pending questions via question:respond.
 */

import { ipcMain } from 'electron'
import { questionBridge } from '../tools/QuestionBridge'

export function registerQuestionHandlers(): void {
  ipcMain.handle('question:respond', async (_e, p: { questionId: string; answer: string }) => {
    const resolved = questionBridge.resolve(p.questionId, p.answer)
    return { success: resolved }
  })

  console.log('[IPC:question] handlers registered')
}
