import { ipcMain } from 'electron'
import { permissionService } from '../permission/PermissionService'

export function registerPermissionHandlers(): void {
  ipcMain.handle('permission:respond', async (_event, params: { requestId: string; decision: string }) => {
    const result = permissionService.resolveRequest(params.requestId, params.decision as 'allow' | 'deny')
    return { success: !!result }
  })

  ipcMain.handle('permission:list-policies', async () => {
    return { policies: permissionService.listPolicies() }
  })

  ipcMain.handle('permission:update-policy', async (_event, params: { id: string; decision: string }) => {
    const result = permissionService.updatePolicy(params.id, params.decision as 'allow' | 'ask' | 'deny')
    return { success: !!result }
  })

  console.log('[IPC:permission] handlers registered')
}
