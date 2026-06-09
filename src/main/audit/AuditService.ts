/**
 * AuditService — plaintext JSONL-backed immutable audit log.
 * Stored at ~/.atta/seek/audit.jsonl.
 */

import { JSONLStore } from '../store/FileStore'
import { newId } from '../store/id'
import { dataDir } from '../store/paths'
import type { AuditLog, AuditEventType, AuditFilters } from '../../shared/types/Audit'
import type { ToolRiskLevel } from '../../shared/types/Tool'

const store = new JSONLStore(`${dataDir()}/audit.jsonl`)

export class AuditService {
  async log(params: {
    taskId?: string; sessionId?: string; projectId?: string;
    eventType: AuditEventType; toolId?: string; riskLevel?: ToolRiskLevel;
    inputSummary?: string; outputSummary?: string; permissionResult?: 'allow' | 'deny';
    artifactRefs?: string[]; metadata?: Record<string, unknown>
  }): Promise<AuditLog> {
    const id = `audit_${newId().slice(0, 8)}`
    const now = Date.now()
    const entry: AuditLog = {
      id, taskId: params.taskId, sessionId: params.sessionId, projectId: params.projectId,
      eventType: params.eventType, toolId: params.toolId, riskLevel: params.riskLevel,
      inputSummary: params.inputSummary, outputSummary: params.outputSummary,
      permissionResult: params.permissionResult, artifactRefs: params.artifactRefs,
      metadata: params.metadata, createdAt: now,
    }
    await store.append(entry)
    return entry
  }

  async query(filters: AuditFilters = {}): Promise<AuditLog[]> {
    let results: AuditLog[] = []
    for await (const e of store.read()) {
      const entry = e as AuditLog
      if (filters.sessionId && entry.sessionId !== filters.sessionId) continue
      if (filters.taskId && entry.taskId !== filters.taskId) continue
      if (filters.projectId && entry.projectId !== filters.projectId) continue
      if (filters.eventType && entry.eventType !== filters.eventType) continue
      if (filters.riskLevel && entry.riskLevel !== filters.riskLevel) continue
      if (filters.from && entry.createdAt < filters.from) continue
      if (filters.to && entry.createdAt > filters.to) continue
      results.push(entry)
    }
    results.sort((a, b) => b.createdAt - a.createdAt)
    if (filters.limit) results = results.slice(0, filters.limit)
    if (filters.offset) results = results.slice(filters.offset)
    return results
  }

  async get(id: string): Promise<AuditLog | undefined> {
    for await (const e of store.read()) {
      if ((e as AuditLog).id === id) return e as AuditLog
    }
    return undefined
  }

  async count(): Promise<number> {
    let n = 0
    for await (const _ of store.read()) n++
    return n
  }
}

export const auditService = new AuditService()
