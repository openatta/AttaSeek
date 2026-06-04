import { ipcMain } from 'electron'
import { toolRegistry } from '../tools/ToolRegistry'

export function registerToolHandlers(): void {
  ipcMain.handle('tool:list', async () => {
    return { tools: toolRegistry.list() }
  })

  console.log('[IPC:tool] handlers registered')
}
