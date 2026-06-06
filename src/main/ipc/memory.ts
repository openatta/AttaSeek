import { ipcMain } from 'electron'
import { memoryService } from '../memory/MemoryService'
import { ipcWrap } from '../store/util'
import type { MemoryQuery, MemoryEntry } from '../../shared/types/Memory'

export function registerMemoryHandlers(): void {
  ipcMain.handle('memory:list', async (_e, f: MemoryQuery) =>
    ipcWrap(() => ({ entries: memoryService.recall(f) })))
  ipcMain.handle('memory:store', async (_e, entry: Omit<MemoryEntry, 'id' | 'layer' | 'createdAt' | 'updatedAt'>) =>
    ipcWrap(() => ({ entry: memoryService.store(entry) })))
  ipcMain.handle('memory:delete', async (_e, p: { id: string }) =>
    ipcWrap(() => ({ success: memoryService.delete(p.id) })))
  console.log('[IPC:memory] handlers registered')
}
