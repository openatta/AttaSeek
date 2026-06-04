import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { platform } from 'os'
import { registerThemeHandlers } from './ipc/theme'
import { registerAgentHandlers, setAgentWindow } from './ipc/agent'
import { registerArtifactHandlers } from './ipc/artifact'
import { registerToolHandlers } from './ipc/tool'
import { registerSkillHandlers } from './ipc/skill'
import { registerPermissionHandlers } from './ipc/permission'
import { registerAuditHandlers } from './ipc/audit'
import { registerMemoryHandlers } from './ipc/memory'
import { registerPluginHandlers } from './ipc/plugin'
import { boot } from './boot'

const isMac = platform() === 'darwin'

// Boot sequence: register skills, tools, plugins
boot()

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

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
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

  // Wire agent event bus to this window
  setAgentWindow(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Dev: Vite dev server URL / Prod: local file
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    // macOS: re-create window on dock click
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
