import { ipcMain } from 'electron'
import { pluginRegistry } from '../plugins/PluginRegistry'

export function registerPluginHandlers(): void {
  ipcMain.handle('plugin:list', async () => {
    return { plugins: pluginRegistry.list() }
  })

  console.log('[IPC:plugin] handlers registered')
}
