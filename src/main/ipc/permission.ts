import { ipcMain } from 'electron'
import { permissionService } from '../permission/PermissionService'
import { permissionBridge } from '../permission/PermissionBridge'
import { ipcWrap } from '../store/util'

export function registerPermissionHandlers(): void {
  ipcMain.handle('permission:respond', async (_e, p: { requestId: string; decision: string }) => {
    const decision = p.decision === 'allow' ? 'allow' as const : 'deny' as const
    // Resolve in PermissionService (updates request status)
    const serviceResult = permissionService.resolveRequest(p.requestId, decision)
    // Resolve in PermissionBridge (unblocks waiting AgentLoop)
    permissionBridge.resolve(p.requestId, decision)
    return ipcWrap(() => ({ success: !!serviceResult }))
  })
  ipcMain.handle('permission:list-policies', async () =>
    ipcWrap(() => ({ policies: permissionService.listPolicies() })))
  ipcMain.handle('permission:update-policy', async (_e, p: { id: string; decision: string }) => {
    const decision = (['allow', 'ask', 'deny'] as const).includes(p.decision as any)
      ? (p.decision as 'allow' | 'ask' | 'deny') : 'ask'
    return ipcWrap(() => ({ success: !!permissionService.updatePolicy(p.id, decision) }))
  })
  console.log('[IPC:permission] handlers registered')
}
