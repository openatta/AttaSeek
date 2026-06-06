/**
 * IPC handlers for agent:* channels.
 * Main process listens; renderer invokes via preload bridge.
 */

import { ipcMain, type BrowserWindow } from 'electron'
import { agentRuntime } from '../agent/AgentRuntime'
import { agentEventBus } from '../agent/AgentEventBus'
import { perf } from '../perf'
import { validateRequiredString } from '../store/util'

let mainWindow: BrowserWindow | null = null
let unsubscribeAgentEvents: (() => void) | null = null

export function setAgentWindow(win: BrowserWindow): void {
  // Clean up previous subscription before creating a new one
  if (unsubscribeAgentEvents) {
    unsubscribeAgentEvents()
    unsubscribeAgentEvents = null
  }

  mainWindow = win

  // Forward all agent events to the renderer
  unsubscribeAgentEvents = agentEventBus.subscribe('*', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:event', event)
    }
  })
}

export function registerAgentHandlers(): void {
  ipcMain.handle('agent:create-task', async (_event, params: { sessionId: string; goal: string; projectId?: string; modelConfigId?: string; modelName?: string }) => {
    validateRequiredString(params, 'sessionId', 'sessionId')
    validateRequiredString(params, 'goal', 'goal')
    const t0 = performance.now()
    try {
      const task = agentRuntime.createTask(params)
      perf.mark('ipc', 'agent:create-task', performance.now() - t0)
      return { success: true, task }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create task',
      }
    }
  })

  ipcMain.handle('agent:cancel-task', async (_event, params: { taskId: string }) => {
    try {
      validateRequiredString(params, 'taskId', 'taskId')
      const cancelled = agentRuntime.cancelTask(params.taskId)
      return { success: cancelled }
    } catch (err) { return { success: false, error: err instanceof Error ? err.message : 'Internal error' } }
  })

  ipcMain.handle('agent:get-task', async (_event, params: { taskId: string }) => {
    try {
      validateRequiredString(params, 'taskId', 'taskId')
      const task = agentRuntime.getTask(params.taskId)
      return { task: task || null }
    } catch (err) { return { task: null, error: err instanceof Error ? err.message : 'Internal error' } }
  })

  ipcMain.handle('agent:list-events', async (_event, params: { sessionId: string }) => {
    try {
      validateRequiredString(params, 'sessionId', 'sessionId')
      const events = agentEventBus.getHistory(params.sessionId)
      return { events }
    } catch (err) { return { events: [], error: err instanceof Error ? err.message : 'Internal error' } }
  })

  console.log('[IPC:agent] handlers registered')
}
