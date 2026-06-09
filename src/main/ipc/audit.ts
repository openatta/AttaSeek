import { ipcMain } from 'electron'
import { auditService } from '../audit/AuditService'
import { ipcWrapAsync } from '../store/util'
import type { AuditFilters } from '../../shared/types/Audit'

const DEFAULT_AUDIT_LIMIT = 200

export function registerAuditHandlers(): void {
  ipcMain.handle('audit:list', async (_e, f: AuditFilters) =>
    ipcWrapAsync(async () => ({ logs: await auditService.query({ limit: DEFAULT_AUDIT_LIMIT, ...f }) })))
  console.log('[IPC:audit] handlers registered')
}
