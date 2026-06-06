import { ipcMain } from 'electron'
import { auditService } from '../audit/AuditService'
import { ipcWrap } from '../store/util'
import type { AuditFilters } from '../../shared/types/Audit'

export function registerAuditHandlers(): void {
  ipcMain.handle('audit:list', async (_e, f: AuditFilters) =>
    ipcWrap(() => ({ logs: auditService.query(f) })))
  console.log('[IPC:audit] handlers registered')
}
