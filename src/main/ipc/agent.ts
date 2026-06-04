/**
 * IPC handlers for agent:* channels.
 * Main process listens; renderer invokes via preload bridge.
 */

import { ipcMain, type BrowserWindow } from 'electron'
import { agentRuntime } from '../agent/AgentRuntime'
import { agentEventBus } from '../agent/AgentEventBus'

let mainWindow: BrowserWindow | null = null

export function setAgentWindow(win: BrowserWindow): void {
  mainWindow = win

  // Forward all agent events to the renderer
  agentEventBus.subscribe('*', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:event', event)
    }
  })
}

export function registerAgentHandlers(): void {
  ipcMain.handle('agent:create-task', async (_event, params: { sessionId: string; goal: string; projectId?: string }) => {
    try {
      const task = agentRuntime.createTask(params.sessionId, params.goal, params.projectId)
      return { success: true, task }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create task',
      }
    }
  })

  ipcMain.handle('agent:cancel-task', async (_event, params: { taskId: string }) => {
    const cancelled = agentRuntime.cancelTask(params.taskId)
    return { success: cancelled }
  })

  ipcMain.handle('agent:get-task', async (_event, params: { taskId: string }) => {
    const task = agentRuntime.getTask(params.taskId)
    return { task: task || null }
  })

  ipcMain.handle('agent:list-events', async (_event, params: { sessionId: string }) => {
    const events = agentEventBus.getHistory(params.sessionId)
    return { events }
  })

  console.log('[IPC:agent] handlers registered')
}
