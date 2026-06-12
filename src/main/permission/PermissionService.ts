/**
 * PermissionService — unified permission checking with three-state decisions.
 * Policies are persisted as plaintext JSON in ~/.atta/seek/permissions.json.
 * Pending requests are in-memory (request lifetime only).
 */

import { JSONStore } from '../store/FileStore'
import { newId } from '../store/id'
import { withMutex } from '../store/mutex'
import { dataDir } from '../store/paths'
import type { PermissionContext, PermissionDecision, PermissionPolicy, PermissionRequest as PermReq } from '../../shared/types/Permission'
import type { ToolRiskLevel } from '../../shared/types/Tool'

const store = new JSONStore<{ policies: PermissionPolicy[] }>(`${dataDir()}/permissions.json`)

export class PermissionService {
  private pendingRequests = new Map<string, PermReq>()
  private autoClassifyEnabled = false

  /** Enable/disable the LLM auto-classifier for risky tool calls. */
  setAutoClassifyEnabled(enabled: boolean): void {
    this.autoClassifyEnabled = enabled
  }

  isAutoClassifyEnabled(): boolean {
    return this.autoClassifyEnabled
  }

  // --- Policy Management (plaintext JSON) ---

  async savePolicy(policy: Omit<PermissionPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<PermissionPolicy> {
    return withMutex(async () => {
      const data = await store.read()
      const policies = data.policies || []
      const now = Date.now()

      // Check for existing policy covering the same scope
      const existingIdx = policies.findIndex(p =>
        p.scope === policy.scope &&
        p.scopeId === policy.scopeId &&
        (p.toolId === policy.toolId || (!p.toolId && !policy.toolId)) &&
        (p.pluginId === policy.pluginId || (!p.pluginId && !policy.pluginId))
      )

      if (existingIdx !== -1) {
        policies[existingIdx].decision = policy.decision
        policies[existingIdx].updatedAt = now
        store.write({ policies })
        return policies[existingIdx]
      }

      const id = `perm_${newId().slice(0, 8)}`
      const entry: PermissionPolicy = { id, ...policy, createdAt: now, updatedAt: now }
      policies.push(entry)
      store.write({ policies })
      return entry
    })
  }

  async listPolicies(): Promise<PermissionPolicy[]> {
    const data = await store.read()
    const policies = data.policies || []
    return policies.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 200)
  }

  async updatePolicy(id: string, decision: PermissionDecision): Promise<PermissionPolicy | null> {
    return withMutex(async () => {
      const data = await store.read()
      const policies = data.policies || []
      const idx = policies.findIndex(p => p.id === id)
      if (idx === -1) return null
      policies[idx].decision = decision
      policies[idx].updatedAt = Date.now()
      store.write({ policies })
      return policies[idx]
    })
  }

  async deletePolicy(id: string): Promise<boolean> {
    return withMutex(async () => {
      const data = await store.read()
      const policies = data.policies || []
      const idx = policies.findIndex(p => p.id === id)
      if (idx === -1) return false
      policies.splice(idx, 1)
      store.write({ policies })
      return true
    })
  }

  // --- Permission Checking ---

  async check(context: PermissionContext): Promise<PermissionDecision> {
    const data = await store.read()
    const policies = data.policies || []

    const scopes = [
      { scope: 'tool', id: context.toolId },
      { scope: 'plugin', id: context.pluginId },
      { scope: 'project', id: context.projectId },
      { scope: 'session', id: context.sessionId },
    ].filter(s => s.id) as { scope: string; id: string }[]

    // Priority: tool > plugin > project > session
    const priorities = ['tool', 'plugin', 'project', 'session']
    for (const p of priorities) {
      const match = policies.find(r =>
        r.scope === p && scopes.some(s => s.scope === p && s.id === r.scopeId)
      )
      if (match) return match.decision as PermissionDecision
    }
    return context.riskLevel === 'risky' ? 'ask' : 'allow'
  }

  /**
   * Check permission with optional auto-classification.
   * If the auto-classifier is enabled and the tool is risky, consult it
   * before falling back to the default 'ask' behavior.
   */
  async checkWithClassify(
    context: PermissionContext,
    toolInput?: Record<string, unknown>,
    toolDescription?: string,
  ): Promise<PermissionDecision> {
    const baseDecision = await this.check(context)

    // Only re-evaluate 'ask' decisions (risky tools without existing policy)
    if (baseDecision !== 'ask' || !this.autoClassifyEnabled) return baseDecision

    try {
      const { classifyToolCall } = await import('./AutoClassifier')

      // Wire the classifier model slot for LLM-based classification
      const callLLM = async (messages: import('../agent/llm/ModelProvider').LLMMessage[]): Promise<string> => {
        const { loadLLMConfig } = await import('../agent/llm/AttaSettingsLoader')
        const { ModelResolver } = await import('../agent/llm/ModelResolver')
        const { modelProviderRegistry } = await import('../agent/llm/ModelProviderRegistry')

        const config = loadLLMConfig()
        if (!config.provider) throw new Error('No LLM provider configured')

        const resolver = new ModelResolver(config.provider)
        const classifierModel = resolver.classifier()

        const provider = modelProviderRegistry.getDefault()
        if (!provider) throw new Error('No active model provider')

        // The classifier sends system instructions as first user message.
        // Extract it as systemPrompt for the provider API.
        const systemPrompt = typeof messages[0]?.content === 'string' ? messages[0].content : ''
        const userMessages = messages.slice(1)

        const result = await provider.chat({
          systemPrompt,
          messages: userMessages,
          tools: [],
          model: classifierModel,
          config: { maxTokens: 10, temperature: 0 },
        })

        const content = result.content
        if (typeof content === 'string') return content
        if (Array.isArray(content)) {
          return content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
        }
        return ''
      }

      const decision = await classifyToolCall(
        {
          toolName: context.toolId,
          toolInput: toolInput || {},
          toolDescription: toolDescription || context.toolId,
        },
        callLLM,
      )
      return decision
    } catch {
      return 'ask' // classifier not available — preserve original
    }
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
    this.pendingRequests.delete(requestId)
    return req
  }
}

export const permissionService = new PermissionService()
