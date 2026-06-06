import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { platform } from 'os'
import { registerThemeHandlers } from './ipc/theme'
import { registerAgentHandlers, setAgentWindow } from './ipc/agent'
import { registerArtifactHandlers } from './ipc/artifact'
import { registerToolHandlers, registerSkillHandlers, registerPluginHandlers } from './ipc/registry'
import { registerPermissionHandlers } from './ipc/permission'
import { registerAuditHandlers } from './ipc/audit'
import { registerMemoryHandlers } from './ipc/memory'
import { registerSessionHandlers, setSessionWindow } from './ipc/session'
import { registerModelHandlers } from './ipc/model'
import { registerAppHandlers } from './ipc/app'
import { boot } from './boot'
import { getDb, closeDb } from './store/db'
import { agentEventBus } from './agent/AgentEventBus'
import { permissionBridge } from './permission/PermissionBridge'
import { subAgentManager } from './agent/subagent/SubAgentManager'
import { cleanupTaskStore } from './agent/tools/implementations/task-mgmt'
import { startTimer } from './perf'

const isMac = platform() === 'darwin'

const bootTimer = startTimer('boot')
boot().catch((err) => { console.error('[boot] failed:', err) }).finally(() => bootTimer())

// Initialize database
const dbTimer = startTimer('db_init')
getDb()
dbTimer()

// Register IPC handlers before creating windows
registerThemeHandlers()
registerAgentHandlers()
registerArtifactHandlers()
registerToolHandlers()
registerSkillHandlers()
registerPermissionHandlers()
registerAuditHandlers()
registerMemoryHandlers()
registerPluginHandlers()
registerSessionHandlers()
registerModelHandlers()
registerAppHandlers()

// ── Window management ──

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    titleBarOverlay: !isMac,
    vibrancy: isMac ? 'sidebar' : undefined,
    visualEffectState: isMac ? 'active' : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow = win

  // Wire agent event bus to this window
  setAgentWindow(win); setSessionWindow(win)

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Dev: Vite dev server URL / Prod: local file
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

// ── App lifecycle ──

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit()
  }
})

// ── Session persistence: save on quit ──

app.on('before-quit', () => {
  // Cleanup task store
  cleanupTaskStore()

  // Cancel all pending permission requests
  permissionBridge.cancelAll()

  // Cancel all running agent tasks and sub-agents
  subAgentManager.cancelAll()
})

app.on('will-quit', () => {
  // Persist session events for all active sessions
  try {
    const db = getDb()
    // Get distinct session IDs from events
    const allEvents = agentEventBus.getHistory('*')
    const sessionIds = new Set(allEvents.map((e) => e.sessionId))
    const insert = db.prepare(
      'INSERT OR REPLACE INTO session_events (id, session_id, task_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    const tx = db.transaction(() => {
      for (const event of allEvents) {
        insert.run(
          event.id, event.sessionId, event.taskId, event.type,
          JSON.stringify(event.payload), event.createdAt,
        )
      }
    })
    tx()
    console.log(`[session] persisted ${allEvents.length} events across ${sessionIds.size} sessions`)
  } catch (err) {
    console.error('[session] failed to persist events:', err)
  }

  closeDb()
})
