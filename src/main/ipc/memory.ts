import { ipcMain } from 'electron'
import { memoryService } from '../memory/MemoryService'
import { ipcWrap } from '../store/util'

export function registerMemoryHandlers(): void {
  ipcMain.handle('memory:list', async (_e, f: Record<string, unknown>) =>
    ipcWrap(() => ({ entries: memoryService.recall(f as any) })))
  ipcMain.handle('memory:store', async (_e, entry: Record<string, unknown>) =>
    ipcWrap(() => ({ entry: memoryService.store(entry as any) })))
  ipcMain.handle('memory:delete', async (_e, p: { id: string }) =>
    ipcWrap(() => ({ success: memoryService.delete(p.id) })))
  console.log('[IPC:memory] handlers registered')
}
