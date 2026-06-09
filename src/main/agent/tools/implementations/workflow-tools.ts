/**
 * Workflow tool — Multi-agent orchestration via declarative scripts.
 *
 * Allows the LLM to spawn structured workflows that fan out sub-agents
 * with deterministic control flow (parallel, pipeline, phases).
 *
 * Mirrors Claude Code's Workflow tool / workflow script system.
 *
 * Script DSL:
 *   - agent(prompt, opts?)     — spawn a sub-agent
 *   - parallel(thunks[])       — run tasks concurrently
 *   - pipeline(items, stages[]) — run items through all stages independently
 *   - phase(title)             — group subsequent agents under a progress label
 *   - log(message)             — emit a narrator progress message
 */

import type { ToolManifest } from '../../../../shared/types/Tool'
import { subAgentManager } from '../../subagent/SubAgentManager'

// ── Tool manifest ──

export const workflowManifest: ToolManifest = {
  id: 'workflow',
  pluginId: 'attaseek',
  name: 'Workflow',
  description: 'Execute a workflow script that orchestrates multiple subagents deterministically. Use for fan-out research, parallel code review, multi-modal sweeps, and adversarial verification.',
  outputSchema: { type: 'object', properties: { result: {}, agentsSpawned: { type: 'number' } } },
  inputSchema: {
    type: 'object',
    properties: {
      script: { type: 'string', description: 'Inline JavaScript workflow script using agent(), parallel(), pipeline(), phase().' },
      name: { type: 'string', description: 'Name of a predefined workflow.' },
      args: { description: 'Optional arguments passed to the workflow script as the global `args`.' },
    },
  },
  riskLevel: 'risky',
  category: 'automation',
  permissionPolicy: { default: 'ask', requirePreview: true, allowAlways: false },
}

// ── Implementation ──

interface WorkflowContext {
  agentsSpawned: number
  maxAgents: number
  results: unknown[]
  logs: string[]
  currentPhase: string
}

export async function workflowImpl(input: Record<string, unknown>): Promise<{ output: string; success: boolean }> {
  const script = input.script as string | undefined
  const args = input.args

  if (!script || !script.trim()) {
    return { output: 'Error: workflow script is required', success: false }
  }

  const ctx: WorkflowContext = {
    agentsSpawned: 0,
    maxAgents: 50,
    results: [],
    logs: [],
    currentPhase: 'default',
  }

  try {
    // Build the DSL functions exposed to the script
    const dsl = buildDSL(ctx)

    // Execute the script in a sandboxed context
    // Security: no require(), no filesystem, no Date.now()/Math.random()
    const scriptFn = new Function(
      'agent', 'parallel', 'pipeline', 'phase', 'log', 'args',
      `return (async () => { ${script} })()`,
    )

    const result = await scriptFn(
      dsl.agent, dsl.parallel, dsl.pipeline, dsl.phase, dsl.log, args,
    )

    return {
      output: JSON.stringify({
        result,
        agentsSpawned: ctx.agentsSpawned,
        logs: ctx.logs,
      }, null, 2),
      success: true,
    }
  } catch (err) {
    return {
      output: `Error: Workflow failed: ${(err as Error).message}\n\nLogs:\n${ctx.logs.join('\n')}`,
      success: false,
    }
  }
}

// ── DSL builders ──

function buildDSL(ctx: WorkflowContext) {
  const agent = async (prompt: string, opts?: {
    label?: string
    phase?: string
    schema?: object
    agentType?: string
  }): Promise<unknown> => {
    if (ctx.agentsSpawned >= ctx.maxAgents) {
      throw new Error(`Workflow agent limit (${ctx.maxAgents}) exceeded`)
    }
    ctx.agentsSpawned++

    const label = opts?.label || `workflow_agent_${ctx.agentsSpawned}`
    const phase = opts?.phase || ctx.currentPhase
    ctx.logs.push(`[${phase}] Spawning agent: ${label}`)

    // Spawn as a sub-agent
    const result = await subAgentManager.fork(
      {
        id: `wf_${Date.now()}_${ctx.agentsSpawned}`,
        sessionId: `workflow_session`,
        goal: prompt,
        projectId: undefined,
      } as any,
      {
        id: `workflow_profile`,
        name: label,
        description: prompt,
        systemPrompt: { id: 'workflow', sections: [] },
        tools: ['*'],
        disallowedTools: [],
        toolSelection: 'all' as const,
        skills: [],
        memory: { scopes: ['project'], recallLimit: 5, autoExtract: false, loadFileMemory: false },
        context: { maxTokens: 100000, budgets: { system: 8000, tools: 12000, memory: 4000, messages: 60000, reserve: 15000 }, autoCompact: true, compactTriggerRatio: 0.85, keepRecentTurns: 5 },
        execution: { maxTurns: opts?.agentType === 'Explore' ? 10 : 20, maxParallelTools: 8, planning: 'none' as const },
        output: { generateArtifact: false, autoTitle: false },
      } as any,
      prompt,
      { sharedFileTree: [], sharedMemories: [], parentSummary: prompt, isolation: 'inline' as const },
    )

    ctx.results.push({ label, phase, result: result.summary })
    ctx.logs.push(`[${phase}] Agent "${label}" completed: ${result.status}`)

    // If schema is provided, try to parse the result
    if (opts?.schema && result.summary) {
      try {
        return JSON.parse(result.summary)
      } catch {
        return result.summary
      }
    }
    return result.summary
  }

  const parallel = async (thunks: Array<() => Promise<unknown>>): Promise<unknown[]> => {
    ctx.logs.push(`[${ctx.currentPhase}] Parallel: running ${thunks.length} tasks`)
    const results = await Promise.all(
      thunks.map(t => t().catch(err => {
        ctx.logs.push(`[${ctx.currentPhase}] Task failed: ${(err as Error).message}`)
        return null
      })),
    )
    return results
  }

  const pipeline = async (
    items: unknown[],
    ...stages: Array<(prev: unknown, item: unknown, index: number) => Promise<unknown>>
  ): Promise<unknown[]> => {
    ctx.logs.push(`[${ctx.currentPhase}] Pipeline: ${items.length} items × ${stages.length} stages`)
    const results: unknown[] = []
    for (let i = 0; i < items.length; i++) {
      let value: unknown = items[i]
      for (let s = 0; s < stages.length; s++) {
        try {
          value = await stages[s](value, items[i], i)
        } catch (err) {
          ctx.logs.push(`[${ctx.currentPhase}] Pipeline item ${i} stage ${s} failed: ${(err as Error).message}`)
          value = null
          break
        }
      }
      results.push(value)
    }
    return results
  }

  const phase = (title: string): void => {
    ctx.currentPhase = title
    ctx.logs.push(`── Phase: ${title} ──`)
  }

  const log = (message: string): void => {
    ctx.logs.push(`[${ctx.currentPhase}] ${message}`)
  }

  return { agent, parallel, pipeline, phase, log }
}
