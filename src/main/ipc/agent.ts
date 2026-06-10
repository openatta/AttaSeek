/**
 * IPC handlers for agent:* channels.
 * Main process listens; renderer invokes via preload bridge.
 */

import { ipcMain, type BrowserWindow } from 'electron'
import { agentRuntime } from '../agent/AgentRuntime'
import { agentEventBus } from '../agent/AgentEventBus'
import { perf } from '../perf'
import { validateRequiredString } from '../store/util'
import { createSession, appendEvent, readEvents } from '../store/SessionStore'

let mainWindow: BrowserWindow | null = null
let unsubscribeAgentEvents: (() => void) | null = null

export function setAgentWindow(win: BrowserWindow): void {
  // Clean up previous subscription before creating a new one
  if (unsubscribeAgentEvents) {
    unsubscribeAgentEvents()
    unsubscribeAgentEvents = null
  }

  mainWindow = win

  // Forward all agent events to the renderer + persist final events to SessionStore
  unsubscribeAgentEvents = agentEventBus.subscribe('*', (event) => {
    // Persist terminal events, skip streaming chunks + empty AgentMessage placeholders
    if (event.type !== 'AgentMessageChunk' &&
        !(event.type === 'AgentMessage' && !(event.payload as { content: string }).content)) {
      appendEvent(event.sessionId, event).catch(() => { /* best-effort */ })
    }

    // Create session on first content (SessionTitleGenerated = first stream chunk).
    // Delaying from create-task to here means the sidebar entry only appears once
    // streaming content has arrived — not on empty user input.
    if (event.type === 'SessionTitleGenerated' && event.payload.title) {
      const title = event.payload.title as string
      createSession(event.sessionId, title, 'chat').then((s) => {
        // Use s.title (the actual stored title) — createSession preserves
        // the original title for existing sessions, preventing sidebar drift.
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('session:updated', { id: event.sessionId, title: s.title })
        }
      }).catch(() => { /* best-effort */ })
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:event', event)
    }
  })
}

export function registerAgentHandlers(): void {
  ipcMain.handle('agent:create-task', async (_event, params: { sessionId: string; goal: string; projectId?: string; modelConfigId?: string; modelName?: string; language?: string }) => {
    const t0 = performance.now()
    try {
      validateRequiredString(params, 'sessionId', 'sessionId')
      validateRequiredString(params, 'goal', 'goal')
      // Session creation is deferred to the first SessionTitleGenerated event
      // (arrives with the first stream chunk) — sidebar entry only appears once
      // streaming output has started, not on empty user input.
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
      return { success: true, task: task || null }
    } catch (err) { return { success: false, task: null, error: err instanceof Error ? err.message : 'Internal error' } }
  })

  ipcMain.handle('agent:list-events', async (_event, params: { sessionId: string }) => {
    try {
      validateRequiredString(params, 'sessionId', 'sessionId')
      const events = await readEvents(params.sessionId)
      return { success: true, events: events as Array<{ id?: string }> }
    } catch (err) { return { success: false, events: [], error: err instanceof Error ? err.message : 'Internal error' } }
  })

  console.log('[IPC:agent] handlers registered')
}
