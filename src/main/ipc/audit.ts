import { ipcMain } from 'electron'
import { auditService } from '../audit/AuditService'

export function registerAuditHandlers(): void {
  ipcMain.handle('audit:list', async (_event, filters: Record<string, unknown>) => {
    return { logs: auditService.query(filters as any) }
  })

  console.log('[IPC:audit] handlers registered')
}
