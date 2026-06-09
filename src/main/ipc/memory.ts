import { ipcMain } from 'electron'
import { memoryService } from '../memory/MemoryService'
import { ipcWrapAsync } from '../store/util'
import type { MemoryQuery, MemoryEntry } from '../../shared/types/Memory'

const DEFAULT_MEMORY_LIMIT = 200

export function registerMemoryHandlers(): void {
  ipcMain.handle('memory:list', async (_e, f: MemoryQuery) =>
    ipcWrapAsync(async () => ({ entries: await memoryService.recall({ limit: DEFAULT_MEMORY_LIMIT, ...f }) })))
  ipcMain.handle('memory:store', async (_e, entry: Omit<MemoryEntry, 'id' | 'layer' | 'createdAt' | 'updatedAt'>) =>
    ipcWrapAsync(async () => ({ entry: await memoryService.store(entry) })))
  ipcMain.handle('memory:delete', async (_e, p: { id: string }) =>
    ipcWrapAsync(async () => ({ success: await memoryService.delete(p.id) })))
  console.log('[IPC:memory] handlers registered')
}
