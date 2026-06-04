/**
 * AuditService — immutable log of agent actions, tool calls, and permission decisions.
 * Always-on; all entries are recorded for compliance and debugging.
 * MVP: in-memory storage. Phase 5+: SQLite persistence.
 */

import type { AuditLog, AuditEventType, AuditFilters } from '../../renderer/core/types/Audit'
import type { ToolRiskLevel } from '../../renderer/core/types/Tool'

export class AuditService {
  private logs: AuditLog[] = []
  private nextId = 1

  /** Record an audit event */
  log(params: {
    taskId?: string
    sessionId?: string
    projectId?: string
    eventType: AuditEventType
    toolId?: string
    riskLevel?: ToolRiskLevel
    inputSummary?: string
    outputSummary?: string
    permissionResult?: 'allow' | 'deny'
    artifactRefs?: string[]
    metadata?: Record<string, unknown>
  }): AuditLog {
    const entry: AuditLog = {
      id: `audit_${this.nextId++}`,
      taskId: params.taskId,
      sessionId: params.sessionId,
      projectId: params.projectId,
      eventType: params.eventType,
      toolId: params.toolId,
      riskLevel: params.riskLevel,
      inputSummary: params.inputSummary,
      outputSummary: params.outputSummary,
      permissionResult: params.permissionResult,
      artifactRefs: params.artifactRefs,
      metadata: params.metadata,
      createdAt: Date.now(),
    }
    this.logs.push(entry)
    return entry
  }

  /** Query audit logs with filters */
  query(filters: AuditFilters = {}): AuditLog[] {
    let results = [...this.logs]

    if (filters.sessionId) results = results.filter((l) => l.sessionId === filters.sessionId)
    if (filters.taskId) results = results.filter((l) => l.taskId === filters.taskId)
    if (filters.projectId) results = results.filter((l) => l.projectId === filters.projectId)
    if (filters.eventType) results = results.filter((l) => l.eventType === filters.eventType)
    if (filters.riskLevel) results = results.filter((l) => l.riskLevel === filters.riskLevel)
    if (filters.from) results = results.filter((l) => l.createdAt >= filters.from!)
    if (filters.to) results = results.filter((l) => l.createdAt <= filters.to!)

    results.sort((a, b) => b.createdAt - a.createdAt)

    if (filters.offset) results = results.slice(filters.offset)
    if (filters.limit) results = results.slice(0, filters.limit)

    return results
  }

  /** Get a single audit log by ID */
  get(id: string): AuditLog | undefined {
    return this.logs.find((l) => l.id === id)
  }

  /** Get total count */
  get count(): number {
    return this.logs.length
  }

  /** Clear all logs (admin only) */
  clear(): void {
    this.logs = []
  }
}

/** Singleton */
export const auditService = new AuditService()
