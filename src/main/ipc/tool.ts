import { ipcMain } from 'electron'
import { toolRegistry } from '../tools/ToolRegistry'
import { ipcWrap } from '../store/util'

export function registerToolHandlers(): void {
  ipcMain.handle('tool:list', async () => ipcWrap(() => ({ tools: toolRegistry.list() })))
  console.log('[IPC:tool] handlers registered')
}
