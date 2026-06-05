import { ipcMain } from 'electron'
import { pluginRegistry } from '../plugins/PluginRegistry'
import { ipcWrap } from '../store/util'

export function registerPluginHandlers(): void {
  ipcMain.handle('plugin:list', async () => ipcWrap(() => ({ plugins: pluginRegistry.list() })))
  console.log('[IPC:plugin] handlers registered')
}
