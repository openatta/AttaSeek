/**
 * IPC handlers for multi-window management.
 *
 * Channels:
 *   renderer→main: window:open-side-chat — open a session in a new window
 *   renderer→main: window:is-side-chat — check if current window is a side chat
 */

import { ipcMain, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const isMac = process.platform === 'darwin'

/** Track side chat windows so we can close them if the session is deleted, etc. */
const sideChatWindows = new Map<string, BrowserWindow>()

function createSideChatWindow(sessionId: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 500,
    height: 700,
    minWidth: 360,
    minHeight: 400,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    titleBarOverlay: !isMac,
    vibrancy: isMac ? 'sidebar' : undefined,
    visualEffectState: isMac ? 'active' : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      additionalArguments: [`--atta-side-chat=${sessionId}`],
    },
  })

  sideChatWindows.set(sessionId, win)
  win.on('closed', () => { sideChatWindows.delete(sessionId) })

  // Load the same renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/side-chat/${sessionId}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: `/side-chat/${sessionId}`,
    })
  }

  return win
}

export function registerWindowHandlers(): void {
  ipcMain.handle('window:open-side-chat', async (_e, p: { sessionId: string }) => {
    try {
      // Check if already open — focus existing window
      const existing = sideChatWindows.get(p.sessionId)
      if (existing && !existing.isDestroyed()) {
        existing.show()
        existing.focus()
        return { success: true }
      }
      createSideChatWindow(p.sessionId)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to open side chat' }
    }
  })

  ipcMain.handle('window:is-side-chat', async () => {
    return { isSideChat: process.argv.some(a => a.startsWith('--atta-side-chat=')) }
  })

  console.log('[IPC:window] handlers registered')
}
