/**
 * IPC handlers for the auto-update system.
 *
 * Channels:
 *   renderer→main: update:check, update:download, update:install,
 *                  update:skip-version, update:get-status,
 *                  update:get-settings, update:set-settings
 *   main→renderer: update:event (push)
 */

import { ipcMain, BrowserWindow } from 'electron'
import { updateManager } from '../update/UpdateManager'
import type { UpdateEvent, UpdateSettings } from '../../shared/types/update'

let _updateWindow: BrowserWindow | null = null

export function setUpdateWindow(win: BrowserWindow | null): void {
  _updateWindow = win
}

function pushEvent(event: UpdateEvent): void {
  if (_updateWindow && !_updateWindow.isDestroyed()) {
    _updateWindow.webContents.send('update:event', event)
  }
}

export function registerUpdateHandlers(): void {
  // Subscribe to UpdateManager events and forward to renderer
  updateManager.onEvent(pushEvent)

  // update:check — manual check triggered by user
  ipcMain.handle('update:check', async () => {
    try {
      const status = await updateManager.check()
      return { success: true, manifest: status.manifest, error: status.error }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Update check failed' }
    }
  })

  // update:download — manual download triggered by user
  ipcMain.handle('update:download', async () => {
    try {
      const status = await updateManager.download()
      return { success: true, manifest: status.manifest }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Download failed' }
    }
  })

  // update:install — trigger install and restart
  ipcMain.handle('update:install', async () => {
    try {
      await updateManager.install()
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Install failed' }
    }
  })

  // update:skip-version — skip a specific version
  ipcMain.handle('update:skip-version', async (_e, p: { version: string }) => {
    try {
      await updateManager.skipVersion(p.version)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Skip version failed' }
    }
  })

  // update:get-status — query current update state
  ipcMain.handle('update:get-status', async () => {
    try {
      const status = await updateManager.getStatus()
      return { success: true, status }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Internal error' }
    }
  })

  // update:get-settings — query update settings
  ipcMain.handle('update:get-settings', async () => {
    try {
      const settings = await updateManager.getSettings()
      return { success: true, settings }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Internal error' }
    }
  })

  // update:set-settings — update settings
  ipcMain.handle('update:set-settings', async (_e, patch: Partial<UpdateSettings>) => {
    try {
      await updateManager.updateSettings(patch)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Internal error' }
    }
  })

  console.log('[IPC:update] handlers registered')
}
