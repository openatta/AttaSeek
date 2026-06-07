/**
 * AuditService — SQLite-backed immutable audit log.
 */

import { getDb, dbQuery, dbQueryOne } from '../store/db'
import { newId } from '../store/id'
import { fromRow } from '../store/util'
import type { AuditLog, AuditEventType, AuditFilters } from '../../shared/types/Audit'
import type { ToolRiskLevel } from '../../shared/types/Tool'

export class AuditService {
  log(params: {
    taskId?: string; sessionId?: string; projectId?: string;
    eventType: AuditEventType; toolId?: string; riskLevel?: ToolRiskLevel;
    inputSummary?: string; outputSummary?: string; permissionResult?: 'allow' | 'deny';
    artifactRefs?: string[]; metadata?: Record<string, unknown>
  }): AuditLog {
    const db = getDb(); const id = `audit_${newId().slice(0, 8)}`; const now = Date.now()
    const ar = params.artifactRefs ? JSON.stringify(params.artifactRefs) : null
    const md = params.metadata ? JSON.stringify(params.metadata) : null
    db.prepare(`INSERT INTO audit_logs (id, task_id, session_id, project_id, event_type, tool_id, risk_level, input_summary, output_summary, permission_result, artifact_refs, metadata, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, params.taskId||null, params.sessionId||null, params.projectId||null, params.eventType, params.toolId||null, params.riskLevel||null, params.inputSummary||null, params.outputSummary||null, params.permissionResult||null, ar, md, now)
    return { id, taskId: params.taskId, sessionId: params.sessionId, projectId: params.projectId, eventType: params.eventType, toolId: params.toolId, riskLevel: params.riskLevel, inputSummary: params.inputSummary, outputSummary: params.outputSummary, permissionResult: params.permissionResult, artifactRefs: params.artifactRefs, metadata: params.metadata, createdAt: now }
  }

  query(filters: AuditFilters = {}): AuditLog[] {
    const db = getDb(); let sql = 'SELECT * FROM audit_logs WHERE 1=1'; const p: any[] = []
    if (filters.sessionId) { sql += ' AND session_id=?'; p.push(filters.sessionId) }
    if (filters.taskId) { sql += ' AND task_id=?'; p.push(filters.taskId) }
    if (filters.projectId) { sql += ' AND project_id=?'; p.push(filters.projectId) }
    if (filters.eventType) { sql += ' AND event_type=?'; p.push(filters.eventType) }
    if (filters.riskLevel) { sql += ' AND risk_level=?'; p.push(filters.riskLevel) }
    if (filters.from) { sql += ' AND created_at>=?'; p.push(filters.from) }
    if (filters.to) { sql += ' AND created_at<=?'; p.push(filters.to) }
    sql += ' ORDER BY created_at DESC'
    if (filters.limit) { sql += ' LIMIT ?'; p.push(filters.limit) }
    if (filters.offset) { sql += ' OFFSET ?'; p.push(filters.offset) }
    return dbQuery<Record<string, unknown>>(sql, ...p).map((r) => fromRow<AuditLog>(r, ['artifactRefs', 'metadata'])).filter((l): l is AuditLog => !!l)
  }

  get(id: string): AuditLog | undefined { return fromRow<AuditLog>(dbQueryOne<Record<string, unknown>>('SELECT * FROM audit_logs WHERE id=?', id), ['artifactRefs', 'metadata']) }

  get count(): number { return dbQueryOne<{ c: number }>('SELECT COUNT(*) as c FROM audit_logs')?.c || 0 }
}

export const auditService = new AuditService()
