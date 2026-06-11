/**
 * IPC handlers for app-level state persistence (session restore, activity state).
 * Uses plaintext JSON store at ~/.atta/seek/app_state.json.
 */
import { ipcMain, dialog } from 'electron'
import { JSONStore } from '../store/FileStore'
import { dataDir } from '../store/paths'

const store = new JSONStore<Record<string, string>>(`${dataDir()}/app_state.json`)

export function registerAppHandlers(): void {
  ipcMain.handle('app:get-state', async (_e, key: string) => {
    try {
      const data = await store.read()
      return { success: true, value: data[key] || null }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Internal error' }
    }
  })

  ipcMain.handle('app:set-state', async (_e, p: { key: string; value: string }) => {
    try {
      const data = await store.read()
      data[p.key] = p.value
      await store.write(data)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Internal error' }
    }
  })

  ipcMain.handle('dialog:select-dir', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择项目目录',
      })
      if (result.canceled || !result.filePaths.length) {
        return { success: true, canceled: true, path: null }
      }
      return { success: true, canceled: false, path: result.filePaths[0] }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Dialog failed' }
    }
  })

  console.log('[IPC:app] handlers registered')
}
