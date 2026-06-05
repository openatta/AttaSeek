import { ipcMain } from 'electron'
import { auditService } from '../audit/AuditService'
import { ipcWrap } from '../store/util'

export function registerAuditHandlers(): void {
  ipcMain.handle('audit:list', async (_e, f: Record<string, unknown>) =>
    ipcWrap(() => ({ logs: auditService.query(f as any) })))
  console.log('[IPC:audit] handlers registered')
}
