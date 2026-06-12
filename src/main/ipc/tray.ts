/**
 * IPC handlers for tray:* channels.
 *
 * Channels:
 *   renderer→main: tray:get-settings, tray:set-settings, tray:platform-info
 *   main→renderer: tray:navigate (push)
 */

import { ipcMain } from 'electron'
import { TraySettings } from '../tray/TraySettings'
import { trayManager } from '../tray/TrayManager'
import type { TraySettingsPatch } from '../../shared/types/tray'

export function registerTrayHandlers(): void {
  ipcMain.handle('tray:get-settings', async () => {
    try {
      const settings = await TraySettings.get()
      return { success: true, settings }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Internal error' }
    }
  })

  ipcMain.handle('tray:set-settings', async (_e, patch: TraySettingsPatch) => {
    try {
      await TraySettings.update(patch)
      // Rebuild menu in case minimizeToTray or other settings changed
      trayManager.rebuildMenu()
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Internal error' }
    }
  })

  ipcMain.handle('tray:platform-info', async () => {
    return {
      trayAvailable: trayManager.isTrayAvailable(),
      platform: process.platform,
    }
  })

  ipcMain.handle('tray:recent-sessions', async () => {
    try {
      const { listSessions } = await import('../store/SessionStore')
      const sessions = await listSessions()
      const recent = sessions.slice(0, 5).map(s => ({ id: s.id, title: s.title }))
      return { success: true, sessions: recent }
    } catch (err) {
      return { success: false, sessions: [], error: err instanceof Error ? err.message : 'Internal error' }
    }
  })

  console.log('[IPC:tray] handlers registered')
}
