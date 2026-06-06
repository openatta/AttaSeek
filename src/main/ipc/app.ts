/**
 * IPC handlers for app-level state persistence (session restore, activity state).
 * Uses inline try/catch (not ipcWrap) because response shape differs from CRUD handlers.
 */
import { ipcMain } from 'electron'
import { getDb, dbQueryOne } from '../store/db'

export function registerAppHandlers(): void {
  ipcMain.handle('app:get-state', async (_e, key: string) => {
    try {
      const row = dbQueryOne<{ value: string }>('SELECT value FROM app_state WHERE key = ?', key)
      return { success: true, value: row?.value || null }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Internal error' }
    }
  })

  ipcMain.handle('app:set-state', async (_e, p: { key: string; value: string }) => {
    try {
      getDb().prepare('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)').run(p.key, p.value)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Internal error' }
    }
  })

  console.log('[IPC:app] handlers registered')
}
