/**
 * PermissionService — unified permission checking with three-state decisions.
 * Policies are persisted in SQLite; pending requests are in-memory (request lifetime only).
 */

import { getDb, dbQuery, dbQueryOne } from '../store/db'
import { newId } from '../store/id'
import { fromRow } from '../store/util'
import type { PermissionContext, PermissionDecision, PermissionPolicy, PermissionRequest as PermReq } from '../../shared/types/Permission'
import type { ToolRiskLevel } from '../../shared/types/Tool'

export class PermissionService {
  private pendingRequests = new Map<string, PermReq>()

  // --- Policy Management (SQLite) ---

  savePolicy(policy: Omit<PermissionPolicy, 'id' | 'createdAt' | 'updatedAt'>): PermissionPolicy {
    const db = getDb()
    const now = Date.now()
    // Check for existing policy covering the same scope
    const row = db.prepare(
      'SELECT id FROM permission_policies WHERE scope=? AND scope_id=? AND (tool_id=? OR tool_id IS NULL) AND (plugin_id=? OR plugin_id IS NULL)'
    ).get(policy.scope, policy.scopeId, policy.toolId || null, policy.pluginId || null) as any

    if (row) {
      const id = row.id
      db.prepare('UPDATE permission_policies SET decision=?, updated_at=? WHERE id=?').run(policy.decision, now, id)
      const r = dbQueryOne<Record<string, unknown>>('SELECT * FROM permission_policies WHERE id=?', id)
      return fromRow<PermissionPolicy>(r)!
    }

    const id = `perm_${newId().slice(0, 8)}`
    db.prepare(`INSERT INTO permission_policies (id, scope, scope_id, tool_id, plugin_id, decision, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(id, policy.scope, policy.scopeId, policy.toolId || null, policy.pluginId || null, policy.decision, now, now)
    return { id, ...policy, createdAt: now, updatedAt: now }
  }

  listPolicies(): PermissionPolicy[] {
    return dbQuery<Record<string, unknown>>('SELECT * FROM permission_policies ORDER BY updated_at DESC LIMIT 200')
      .map((r) => fromRow<PermissionPolicy>(r))
  }

  updatePolicy(id: string, decision: PermissionDecision): PermissionPolicy | null {
    const db = getDb()
    const now = Date.now()
    db.prepare('UPDATE permission_policies SET decision=?, updated_at=? WHERE id=?').run(decision, now, id)
    const r = dbQueryOne<Record<string, unknown>>('SELECT * FROM permission_policies WHERE id=?', id)
    return r ? fromRow<PermissionPolicy>(r) : null
  }

  deletePolicy(id: string): boolean {
    return getDb().prepare('DELETE FROM permission_policies WHERE id=?').run(id).changes > 0
  }

  // --- Permission Checking ---

  check(context: PermissionContext): PermissionDecision {
    const db = getDb()
    const scopes = [
      { scope: 'tool', id: context.toolId },
      { scope: 'plugin', id: context.pluginId },
      { scope: 'project', id: context.projectId },
      { scope: 'session', id: context.sessionId },
    ].filter(s => s.id)
    const rows = db.prepare(
      `SELECT scope, decision FROM permission_policies WHERE (scope, scope_id) IN (${scopes.map(() => '(?,?)').join(',')})`
    ).all(...scopes.flatMap(s => [s.scope, s.id])) as any[]
    // Priority: tool > plugin > project > session
    const priorities = ['tool', 'plugin', 'project', 'session']
    for (const p of priorities) {
      const match = rows.find((r: any) => r.scope === p)
      if (match) return match.decision as PermissionDecision
    }
    return context.riskLevel === 'risky' ? 'ask' : 'allow'
  }

  // --- Permission Requests ---

  requestPermission(params: {
    taskId: string; toolCallId: string; toolId: string; toolName: string
    riskLevel: ToolRiskLevel; action: string; preview: string; impact: string; rollbackable: boolean
  }): PermReq {
    const id = `permreq_${newId().slice(0, 8)}`
    const req: PermReq = { ...params, id, status: 'pending', createdAt: Date.now() }
    this.pendingRequests.set(id, req)
    return req
  }

  resolveRequest(requestId: string, decision: 'allow' | 'deny'): PermReq | null {
    const req = this.pendingRequests.get(requestId)
    if (!req) return null
    req.status = decision === 'allow' ? 'allowed' : 'denied'
    req.resolvedAt = Date.now()
    this.pendingRequests.delete(requestId) // Evict resolved requests
    return req
  }

}

export const permissionService = new PermissionService()
