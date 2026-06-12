/**
 * IPC handlers for terminal:* channels.
 *
 * Uses node-pty to spawn pseudo-terminal processes in the main process.
 * Each terminal has a unique ID; output is pushed to the renderer via events.
 * Terminal sessions, profiles, and bookmarks are persisted via TerminalStore.
 */

import { ipcMain, type BrowserWindow } from 'electron'
import { ipcWrapAsync, validateRequiredString } from '../store/util'
import { terminalStore } from '../store/TerminalStore'
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
      // Resolve cwd: use provided path (if non-empty and not '~'), else home dir.
      // path.resolve() doesn't expand shell '~', so we normalize here.
      const rawCwd = p.cwd && p.cwd !== '~' ? p.cwd : os.homedir()
      const cols = p.cols || 80
      const rows = p.rows || 24

      const pty = ptyModule.spawn(getShell(), getShellArgs(), {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: path.resolve(rawCwd),
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

  // terminal:destroy → kill PTY, save session, and clean up
  ipcMain.handle('terminal:destroy', async (_e, p: { terminalId: string; cwd?: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'terminalId', 'terminalId')
      const instance = terminals.get(p.terminalId)
      if (instance) {
        // Save terminal session before destroying
        if (p.cwd) {
          const shell = getShell()
          terminalStore.saveSession({
            cwd: p.cwd,
            label: `Terminal at ${path.basename(p.cwd)}`,
            lastActiveAt: Date.now(),
            isAlive: false,
            shell,
          }).catch(() => {})
        }

        // Remove from map first to prevent onExit double-delete
        terminals.delete(p.terminalId)
        instance.pty.kill()
      }
      return { success: true }
    })
  })

  // ── Terminal session persistence ──

  // terminal:save-session → save current terminal state
  ipcMain.handle('terminal:save-session', async (_e, p: { cwd: string; label?: string }) => {
    return ipcWrapAsync(async () => {
      const session = await terminalStore.saveSession({
        cwd: p.cwd,
        label: p.label || `Terminal at ${path.basename(p.cwd)}`,
        lastActiveAt: Date.now(),
        isAlive: true,
        shell: getShell(),
      })
      return session as unknown as Record<string, unknown>
    })
  })

  // terminal:list-sessions → list recent terminal sessions
  ipcMain.handle('terminal:list-sessions', async () => {
    return ipcWrapAsync(async () => {
      const sessions = await terminalStore.listSessions()
      return { sessions } as Record<string, unknown>
    })
  })

  // terminal:delete-session → delete a session record
  ipcMain.handle('terminal:delete-session', async (_e, p: { sessionId: string }) => {
    return ipcWrapAsync(async () => {
      validateRequiredString(p, 'sessionId', 'sessionId')
      const deleted = await terminalStore.deleteSession(p.sessionId)
      return { deleted } as Record<string, unknown>
    })
  })

  // ── Terminal profiles ──

  // terminal:list-profiles
  ipcMain.handle('terminal:list-profiles', async () => {
    return ipcWrapAsync(async () => {
      const profiles = await terminalStore.listProfiles()
      return { profiles } as Record<string, unknown>
    })
  })

  // terminal:save-profile
  ipcMain.handle('terminal:save-profile', async (_e, p: { name: string; cwd: string; initialCommand?: string; shell?: string; env?: Record<string, string>; order?: number }) => {
    return ipcWrapAsync(async () => {
      const profile = await terminalStore.saveProfile({
        name: p.name,
        cwd: p.cwd,
        initialCommand: p.initialCommand,
        shell: p.shell,
        env: p.env,
        order: p.order || 0,
      })
      return profile as unknown as Record<string, unknown>
    })
  })

  // terminal:update-profile
  ipcMain.handle('terminal:update-profile', async (_e, p: { id: string; name?: string; cwd?: string; initialCommand?: string; shell?: string; env?: Record<string, string>; order?: number }) => {
    return ipcWrapAsync(async () => {
      const profile = await terminalStore.updateProfile(p.id, {
        name: p.name,
        cwd: p.cwd,
        initialCommand: p.initialCommand,
        shell: p.shell,
        env: p.env,
        order: p.order,
      })
      return (profile ?? {}) as Record<string, unknown>
    })
  })

  // terminal:delete-profile
  ipcMain.handle('terminal:delete-profile', async (_e, p: { id: string }) => {
    return ipcWrapAsync(async () => {
      const deleted = await terminalStore.deleteProfile(p.id)
      return { deleted } as Record<string, unknown>
    })
  })

  // ── Terminal bookmarks ──

  // terminal:list-bookmarks
  ipcMain.handle('terminal:list-bookmarks', async () => {
    return ipcWrapAsync(async () => {
      const bookmarks = await terminalStore.listBookmarks()
      return { bookmarks } as Record<string, unknown>
    })
  })

  // terminal:save-bookmark
  ipcMain.handle('terminal:save-bookmark', async (_e, p: { cwd: string; label: string }) => {
    return ipcWrapAsync(async () => {
      const bookmark = await terminalStore.saveBookmark({
        cwd: p.cwd,
        label: p.label,
      })
      return bookmark as unknown as Record<string, unknown>
    })
  })

  // terminal:delete-bookmark
  ipcMain.handle('terminal:delete-bookmark', async (_e, p: { id: string }) => {
    return ipcWrapAsync(async () => {
      const deleted = await terminalStore.deleteBookmark(p.id)
      return { deleted } as Record<string, unknown>
    })
  })

  console.log('[IPC:terminal] handlers registered')
}
