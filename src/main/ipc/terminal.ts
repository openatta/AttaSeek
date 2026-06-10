/**
 * IPC handlers for terminal:* channels.
 *
 * Uses node-pty to spawn pseudo-terminal processes in the main process.
 * Each terminal has a unique ID; output is pushed to the renderer via events.
 */

import { ipcMain, type BrowserWindow } from 'electron'
import { ipcWrapAsync, validateRequiredString } from '../store/util'
import * as os from 'os'
import * as path from 'path'

const MAX_TERMINALS = 10

// node-pty — dynamic require to avoid issues if native module isn't available
let ptyModule: typeof import('node-pty') | null = null
try {
  ptyModule = require('node-pty')
} catch {
  console.warn('[IPC:terminal] node-pty not available — terminal will use fallback')
}

interface PtyInstance {
  pty: import('node-pty').IPty
}

const terminals = new Map<string, PtyInstance>()
let mainWindow: BrowserWindow | null = null

export function setTerminalWindow(win: BrowserWindow): void {
  mainWindow = win
}

function generateTerminalId(): string {
  return `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe'
  }
  return process.env.SHELL || '/bin/bash'
}

function getShellArgs(): string[] {
  if (process.platform === 'win32') return []
  return ['--login']
}

export function registerTerminalHandlers(): void {
  // terminal:create → spawn a new PTY
  ipcMain.handle('terminal:create', async (_e, p: { cwd?: string; cols?: number; rows?: number }) => {
    return ipcWrapAsync(async () => {
      if (!ptyModule) throw new Error('node-pty is not available')

      if (terminals.size >= MAX_TERMINALS) {
        throw new Error(`Maximum terminal limit reached (${MAX_TERMINALS}). Close an existing terminal first.`)
      }

      const id = generateTerminalId()
      const cwd = p.cwd || os.homedir()
      const cols = p.cols || 80
      const rows = p.rows || 24

      const pty = ptyModule.spawn(getShell(), getShellArgs(), {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: path.resolve(cwd),
        env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
      })

      const instance: PtyInstance = { pty }
      terminals.set(id, instance)

      // Forward PTY output to renderer
      pty.onData((data: string) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:output', { terminalId: id, data })
        }
      })

      pty.onExit(({ exitCode }: { exitCode: number }) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:output', {
            terminalId: id,
            data: `\r\n[Process exited with code ${exitCode}]\r\n`,
          })
        }
        // Only delete if this instance is still in the map (guard against double-delete)
        if (terminals.get(id) === instance) {
          terminals.delete(id)
        }
      })

      return { terminalId: id }
    })
  })

  // terminal:write → send input to PTY
  ipcMain.handle('terminal:write', async (_e, p: { terminalId: string; data: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'terminalId', 'terminalId')
      const instance = terminals.get(p.terminalId)
      if (instance) {
        instance.pty.write(p.data)
      }
      return { success: true }
    })
  })

  // terminal:resize → resize PTY
  ipcMain.handle('terminal:resize', async (_e, p: { terminalId: string; cols: number; rows: number }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'terminalId', 'terminalId')
      const instance = terminals.get(p.terminalId)
      if (instance) {
        instance.pty.resize(p.cols || 80, p.rows || 24)
      }
      return { success: true }
    })
  })

  // terminal:destroy → kill PTY and clean up
  ipcMain.handle('terminal:destroy', async (_e, p: { terminalId: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'terminalId', 'terminalId')
      const instance = terminals.get(p.terminalId)
      if (instance) {
        // Remove from map first to prevent onExit double-delete
        terminals.delete(p.terminalId)
        instance.pty.kill()
      }
      return { success: true }
    })
  })

  console.log('[IPC:terminal] handlers registered')
}
