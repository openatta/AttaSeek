/**
 * IPC handlers for session:* channels.
 * Uses SessionStore (JSON + JSONL, async I/O) — aligned with Claude Code / Codex patterns.
 */

import { ipcMain, type BrowserWindow } from 'electron'
import { newId } from '../store/id'
import { agentEventBus } from '../agent/AgentEventBus'
import { ipcWrap, ipcWrapAsync, validateRequiredString } from '../store/util'
import { createSession, getSession, listSessions, updateSession, deleteSession, appendEvents, readEvents, setProjectSessions } from '../store/SessionStore'

let mainWindow: BrowserWindow | null = null

export function setSessionWindow(win: BrowserWindow): void { mainWindow = win }

export function registerSessionHandlers(): void {
  ipcMain.handle('session:create', async (_e, p: { title?: string; activity?: string; id?: string }) => {
    return ipcWrapAsync(async () => {
      const s = await createSession(p.id || newId().slice(0, 12), p.title || 'New Session', p.activity || 'chat')
      return { session: s }
    })
  })

  ipcMain.handle('session:list', async (_e, p?: { activity?: string; limit?: number }) => {
    return ipcWrapAsync(async () => {
      const sessions = await listSessions(p?.activity)
      return { sessions: sessions.slice(0, p?.limit ?? 200) }
    })
  })

  ipcMain.handle('session:get', async (_e, p: { id: string }) => {
    validateRequiredString(p, 'id', 'id')
    return ipcWrapAsync(async () => ({ session: await getSession(p.id) || null }))
  })

  ipcMain.handle('session:update', async (_e, p: { id: string; title?: string }) => {
    validateRequiredString(p, 'id', 'id')
    return ipcWrapAsync(async () => {
      const s = await updateSession(p.id, { title: p.title })
      if (s && mainWindow) mainWindow.webContents.send('session:updated', { id: s.id, title: s.title })
      return { session: s || null }
    })
  })

  ipcMain.handle('session:delete', async (_e, p: { id: string }) => {
    validateRequiredString(p, 'id', 'id')
    return ipcWrapAsync(async () => {
      agentEventBus.clearHistory(p.id); return { success: await deleteSession(p.id) }
    })
  })

  // Event persistence: append events to JSONL on save
  ipcMain.handle('session:save-events', async (_e, p: { sessionId: string }) => {
    validateRequiredString(p, 'sessionId', 'sessionId')
    return ipcWrapAsync(async () => {
      const events = agentEventBus.getHistory(p.sessionId)
      await appendEvents(p.sessionId, events)
      return { success: true, count: events.length }
    })
  })

  ipcMain.handle('session:load-events', async (_e, p: { sessionId: string }) => {
    validateRequiredString(p, 'sessionId', 'sessionId')
    return ipcWrapAsync(async () => ({ events: await readEvents(p.sessionId) }))
  })

  console.log('[IPC:session] handlers registered')
}
