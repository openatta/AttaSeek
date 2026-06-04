import { ipcMain } from 'electron'
import { memoryService } from '../memory/MemoryService'

export function registerMemoryHandlers(): void {
  ipcMain.handle('memory:list', async (_event, filters: Record<string, unknown>) => {
    return { entries: memoryService.recall(filters as any) }
  })

  ipcMain.handle('memory:store', async (_event, entry: Record<string, unknown>) => {
    const stored = memoryService.store(entry as any)
    return { entry: stored }
  })

  ipcMain.handle('memory:delete', async (_event, params: { id: string }) => {
    const success = memoryService.delete(params.id)
    return { success }
  })

  console.log('[IPC:memory] handlers registered')
}
