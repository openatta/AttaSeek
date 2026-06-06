import { ipcMain } from 'electron'
import { permissionService } from '../permission/PermissionService'
import { permissionBridge } from '../permission/PermissionBridge'
import { ipcWrap } from '../store/util'
import type { PermissionDecision } from '../../shared/types/Permission'

const VALID_POLICY_DECISIONS: readonly PermissionDecision[] = ['allow', 'ask', 'deny'] as const

function parsePolicyDecision(raw: string): PermissionDecision {
  return (VALID_POLICY_DECISIONS as readonly string[]).includes(raw)
    ? (raw as PermissionDecision) : 'ask'
}

/** Per-request decisions are only allow/deny — 'ask' is a policy-level setting. */
function parseRequestDecision(raw: string): 'allow' | 'deny' {
  return raw === 'allow' ? 'allow' : 'deny'
}

export function registerPermissionHandlers(): void {
  ipcMain.handle('permission:respond', async (_e, p: { requestId: string; decision: string }) => {
    const decision = parseRequestDecision(p.decision)
    const serviceResult = permissionService.resolveRequest(p.requestId, decision)
    permissionBridge.resolve(p.requestId, decision)
    return ipcWrap(() => ({ success: !!serviceResult }))
  })
  ipcMain.handle('permission:list-policies', async () =>
    ipcWrap(() => ({ policies: permissionService.listPolicies() })))
  ipcMain.handle('permission:update-policy', async (_e, p: { id: string; decision: string }) =>
    ipcWrap(() => ({ success: !!permissionService.updatePolicy(p.id, parsePolicyDecision(p.decision)) })))
  console.log('[IPC:permission] handlers registered')
}
