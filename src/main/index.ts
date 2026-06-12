import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { platform } from 'os'
import { appendFileSync, mkdirSync, existsSync } from 'fs'
import { dirname } from 'path'
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
import { registerQuestionHandlers } from './ipc/question'
import { registerFilesystemHandlers } from './ipc/filesystem'
import { registerGitHandlers } from './ipc/git'
import { registerTerminalHandlers, setTerminalWindow } from './ipc/terminal'
import { registerProjectHandlers } from './ipc/project'
import { registerUpdateHandlers, setUpdateWindow } from './ipc/update'
import { registerTrayHandlers } from './ipc/tray'
import { registerWindowHandlers } from './ipc/window'
import { updateManager } from './update/UpdateManager'
import { trayManager } from './tray/TrayManager'
import { AutoLauncher } from './tray/AutoLauncher'
import { TraySettings } from './tray/TraySettings'
import { GlobalShortcuts } from './tray/GlobalShortcuts'
import { WindowState } from './WindowState'
import { boot } from './boot'
import { agentEventBus } from './agent/AgentEventBus'
import { permissionBridge } from './permission/PermissionBridge'
import { questionBridge } from './tools/QuestionBridge'
import { subAgentManager } from './agent/subagent/SubAgentManager'
import { cleanupTaskStore } from './agent/tools/implementations/task-mgmt'
import { startTimer } from './perf'
import { ensureDataDir, dataDir } from './store/paths'
import { newId } from './store/id'

const isMac = platform() === 'darwin'

// ── Crash reporting ──
// Global uncaught exception / unhandled rejection handlers.
// Writes a fatal error event to the telemetry JSONL store before quitting.
// This is the last-resort safety net — structured error handling should
// happen in the query loop and IPC handlers. These handlers exist so that
// crashes never go completely unrecorded.

function writeCrashEvent(kind: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined

  console.error(`[crash] ${kind}:`, message)
  if (stack) console.error(stack)

  // Best-effort sync write to telemetry JSONL — must be synchronous in crash handlers
  try {
    const dir = `${dataDir()}`
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const filePath = `${dir}/telemetry.jsonl`
    appendFileSync(filePath, JSON.stringify({
      id: newId(),
      type: 'agent_fatal_error',
      queryChainId: 'crash',
      queryDepth: 0,
      timestamp: Date.now(),
      payload: {
        kind,
        message: message.slice(0, 500),
        stack: stack ? stack.split('\n').slice(0, 10).join('\n') : undefined,
        sessionId: 'crash',
        taskId: 'crash',
      },
    }) + '\n', 'utf-8')
  } catch {
    // If even writing the crash event fails, there's nothing more we can do
  }
}

process.on('uncaughtException', (err) => {
  writeCrashEvent('uncaughtException', err)
  // Flush buffered events if possible
  try { agentEventBus.flushAsync() } catch { /* ignore */ }
  app.quit()
})

process.on('unhandledRejection', (reason) => {
  writeCrashEvent('unhandledRejection', reason)
})

const bootTimer = startTimer('boot')
boot().catch((err) => { console.error('[boot] failed:', err) }).finally(() => bootTimer())

// Initialize data directory for plaintext storage
ensureDataDir()

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
registerQuestionHandlers()
registerFilesystemHandlers()
registerGitHandlers()
registerTerminalHandlers()
registerProjectHandlers()
registerUpdateHandlers()
registerTrayHandlers()
registerWindowHandlers()

// ── Window management ──

let mainWindow: BrowserWindow | null = null

async function createWindow(): Promise<BrowserWindow> {
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
      contextIsolation: true,
      webviewTag: true
    }
  })

  mainWindow = win

  // Restore previous window position/size
  await WindowState.restore(win)

  // Track window state changes for persistence
  WindowState.track(win)

  // Wire agent event bus to this window
  setAgentWindow(win); setSessionWindow(win); setTerminalWindow(win); setUpdateWindow(win)

  win.on('ready-to-show', () => {
    win.show()
  })

  // Tray: intercept close event for minimize-to-tray behavior
  win.on('close', (e) => {
    if (trayManager.handleClose(win)) {
      e.preventDefault()
    }
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

app.whenReady().then(async () => {
  // Create tray icon before windows (so it's ready even if windows start hidden)
  await trayManager.create()

  // Register global shortcuts
  GlobalShortcuts.register()

  // Determine if we should start minimized (auto-start + startMinimized setting)
  const autoStarted = AutoLauncher.wasAutoStarted()
  const settings = await TraySettings.get()
  const startMinimized = autoStarted && settings.startMinimized

  await createWindow()
  if (startMinimized) {
    // Hide windows that were created — they won't show since we haven't called show() yet
    // but `ready-to-show` fires show(). Prevent this by hiding immediately after create.
    mainWindow?.hide()
  }

  // Start update manager after window is created so push events reach the renderer
  updateManager.start().catch((err) => console.warn('[update] start failed:', err))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      // On macOS, activate with existing windows → show them all
      trayManager.showAllWindows()
    }
  })
})

app.on('window-all-closed', () => {
  // With tray: don't quit — app stays alive in tray
  // Without tray (or Linux degradation): quit as normal
  if (!trayManager.isTrayAvailable()) {
    app.quit()
  }
  // Otherwise: windows are hidden to tray, app stays running
})

// ── Session persistence: save on quit ──

app.on('before-quit', async () => {
  // Unregister global shortcuts
  GlobalShortcuts.unregister()

  // Destroy tray icon
  trayManager.destroy()

  // Cleanup task store
  cleanupTaskStore()

  // Shut down isolated plugin processes
  try {
    const { pluginLoader } = await import('./plugins/PluginLoader')
    await pluginLoader.shutdown()
  } catch (err) {
    console.warn('[app] plugin shutdown failed:', (err as Error).message)
  }

  // Cancel all pending permission requests and questions
  permissionBridge.cancelAll()
  questionBridge.cancelAll()

  // Cancel all running agent tasks and sub-agents
  subAgentManager.cancelAll()
})

app.on('will-quit', () => {
  // Session events are persisted progressively by SessionStore (plaintext JSONL).
  // No bulk flush needed — each event is appended as it occurs.
  subAgentManager.cancelAll()
})
