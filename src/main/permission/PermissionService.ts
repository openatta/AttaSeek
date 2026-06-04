/**
 * PermissionService — unified permission checking with three-state decisions.
 * Check order: tool-level policy > plugin-level > risk-level > global default.
 */

import type { PermissionContext, PermissionDecision, PermissionPolicy, PermissionRequest as PermReq, PermissionScope } from '../../renderer/core/types/Permission'
import type { ToolRiskLevel } from '../../renderer/core/types/Tool'

export class PermissionService {
  private policies: PermissionPolicy[] = []
  private pendingRequests: Map<string, PermReq> = new Map()
  private nextId = 1

  // --- Policy Management ---

  savePolicy(policy: Omit<PermissionPolicy, 'id' | 'createdAt' | 'updatedAt'>): PermissionPolicy {
    const now = Date.now()
    const existing = this.policies.find(
      (p) =>
        p.scope === policy.scope &&
        p.scopeId === policy.scopeId &&
        p.toolId === policy.toolId &&
        p.pluginId === policy.pluginId,
    )

    if (existing) {
      existing.decision = policy.decision
      existing.updatedAt = now
      return existing
    }

    const newPolicy: PermissionPolicy = {
      ...policy,
      id: `perm_${this.nextId++}`,
      createdAt: now,
      updatedAt: now,
    }
    this.policies.push(newPolicy)
    return newPolicy
  }

  listPolicies(): PermissionPolicy[] {
    return [...this.policies]
  }

  updatePolicy(id: string, decision: PermissionDecision): PermissionPolicy | null {
    const policy = this.policies.find((p) => p.id === id)
    if (!policy) return null
    policy.decision = decision
    policy.updatedAt = Date.now()
    return policy
  }

  deletePolicy(id: string): boolean {
    const idx = this.policies.findIndex((p) => p.id === id)
    if (idx === -1) return false
    this.policies.splice(idx, 1)
    return true
  }

  // --- Permission Checking ---

  /** Check permission for a tool in context. Returns the effective decision. */
  check(context: PermissionContext): PermissionDecision {
    // 1. Tool-level policy (most specific)
    const toolPolicy = this.findPolicy('tool', context.toolId, context.toolId)
    if (toolPolicy) return toolPolicy.decision

    // 2. Plugin-level policy
    const pluginPolicy = this.findPolicy('plugin', context.pluginId, context.pluginId)
    if (pluginPolicy) return pluginPolicy.decision

    // 3. Project-level policy
    if (context.projectId) {
      const projectPolicy = this.findPolicy('project', context.projectId, context.projectId)
      if (projectPolicy) return projectPolicy.decision
    }

    // 4. Session-level policy
    const sessionPolicy = this.findPolicy('session', context.sessionId, context.sessionId)
    if (sessionPolicy) return sessionPolicy.decision

    // 5. Risk-level default
    const riskPolicy = this.policies.find((p) => p.scope === 'risk_level' && p.scopeId === context.riskLevel)
    if (riskPolicy) return riskPolicy.decision

    // 6. Global default
    const globalPolicy = this.policies.find((p) => p.scope === 'global')
    if (globalPolicy) return globalPolicy.decision

    // 7. Fallback: risky tools ask, others allow
    return context.riskLevel === 'risky' ? 'ask' : 'allow'
  }

  /** Create a permission request for user confirmation */
  requestPermission(
    taskId: string,
    toolCallId: string,
    toolId: string,
    toolName: string,
    riskLevel: ToolRiskLevel,
    action: string,
    preview: string,
    impact: string,
    rollbackable: boolean,
  ): PermReq {
    const id = `permreq_${this.nextId++}`
    const request: PermReq = {
      id,
      taskId,
      toolCallId,
      toolId,
      toolName,
      riskLevel,
      action,
      preview,
      impact,
      rollbackable,
      status: 'pending',
      createdAt: Date.now(),
    }
    this.pendingRequests.set(id, request)
    return request
  }

  /** Resolve a pending permission request */
  resolveRequest(requestId: string, decision: 'allow' | 'deny'): PermReq | null {
    const request = this.pendingRequests.get(requestId)
    if (!request) return null
    request.status = decision === 'allow' ? 'allowed' : 'denied'
    request.resolvedAt = Date.now()
    return request
  }

  /** Get a pending request */
  getRequest(id: string): PermReq | undefined {
    return this.pendingRequests.get(id)
  }

  /** List all pending requests for a task */
  getPendingForTask(taskId: string): PermReq[] {
    return Array.from(this.pendingRequests.values()).filter((r) => r.taskId === taskId && r.status === 'pending')
  }

  // --- Helpers ---

  private findPolicy(scope: PermissionScope, scopeId: string, _searchId?: string): PermissionPolicy | undefined {
    return this.policies.find((p) => p.scope === scope && p.scopeId === scopeId)
  }
}

/** Singleton */
export const permissionService = new PermissionService()
