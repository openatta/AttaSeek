/**
 * IPC handlers for session:* channels.
 * Uses SessionStore (JSON + JSONL, async I/O) — aligned with Claude Code / Codex patterns.
 */

import { ipcMain, type BrowserWindow } from 'electron'
import { newId } from '../store/id'
import { agentEventBus } from '../agent/AgentEventBus'
import { ipcWrapAsync, validateRequiredString } from '../store/util'
import { createSession, getSession, listSessions, updateSession, deleteSession, setProjectSessions } from '../store/SessionStore'

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
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'id', 'id')
      return { session: await getSession(p.id) || null }
    })
  })

  ipcMain.handle('session:update', async (_e, p: { id: string; title?: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'id', 'id')
      const s = await updateSession(p.id, { title: p.title })
      if (s && mainWindow) mainWindow.webContents.send('session:updated', { id: s.id, title: s.title })
      return { session: s || null }
    })
  })

  ipcMain.handle('session:delete', async (_e, p: { id: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'id', 'id')
      agentEventBus.clearHistory(p.id); return { success: await deleteSession(p.id) }
    })
  })

  // Event persistence is handled directly in main/index.ts quit sequence
  // (appendEvents / readEvents called without IPC). The session:save-events
  // and session:load-events channels were registered but never exposed through
  // the preload bridge, making them unreachable from the renderer.

  console.log('[IPC:session] handlers registered')
}
