/**
 * IPC handlers for question:* channels.
 * Renderer sends user's answer to pending questions via question:respond.
 */

import { ipcMain } from 'electron'
import { questionBridge } from '../tools/QuestionBridge'
import { ipcWrapAsync, validateRequiredString } from '../store/util'

export function registerQuestionHandlers(): void {
  ipcMain.handle('question:respond', async (_e, p: { questionId: string; answer: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'questionId', 'questionId')
      const resolved = questionBridge.resolve(p.questionId, p.answer)
      return { resolved }
    })
  })

  console.log('[IPC:question] handlers registered')
}
