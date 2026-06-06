import { ipcMain, nativeTheme, BrowserWindow } from 'electron'
import { ipcWrap } from '../store/util'

type Theme = 'dark' | 'light' | 'system'

function validateTheme(v: unknown): v is Theme {
  return v === 'dark' || v === 'light' || v === 'system'
}

let currentTheme: Theme = 'dark'

export function registerThemeHandlers(): void {
  ipcMain.handle('theme:get', () =>
    ipcWrap(() => ({ theme: currentTheme })))

  ipcMain.handle('theme:set', (_event, args: { theme: unknown }) =>
    ipcWrap(() => {
      if (!validateTheme(args?.theme)) {
        throw new Error(
          `Invalid theme: ${String(args?.theme)}. Must be dark, light, or system.`
        )
      }
      currentTheme = args.theme as Theme
      return { success: true }
    }))

  // Emit system theme changes to all renderers in 'system' mode
  nativeTheme.on('updated', () => {
    const systemTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('theme:system-changed', { theme: systemTheme })
    })
  })
}
