/**
 * Boot sequence — registers skills, tools, and plugins before renderer starts.
 * Called once from main/index.ts.
 */

import { skillRegistry } from './skills/SkillRegistry'
import { toolRegistry } from './tools/ToolRegistry'
import { pluginLoader } from './plugins/PluginLoader'
import { modelConfigService } from './model/ModelConfigService'
import { hookManager } from './agent/hooks/HookManager'
import { confidenceHook, coachingHook, briefHook, memoryHook } from './agent/hooks/hooks/builtin-hooks'
import { memoryExtractionHook } from './agent/hooks/hooks/builtin-stop-hooks'
import { hookPipeline } from './agent/hooks/HookPipeline'
import { loadSkillsFromDir } from './agent/skills/SkillLoader'
import { DEMO_SKILLS } from './skills/packs/demo-pack'
import { DEMO_TOOLS } from './agent/tools/implementations/demo-tools'
import { RESEARCH_TOOLS } from './agent/tools/implementations/research-tools'
import { LSP_TOOLS } from './agent/tools/implementations/lsp-tools'
import { NOTIFICATION_TOOLS } from './agent/tools/implementations/notification-tools'
import { BASH_TOOLS } from './agent/tools/implementations/bash-tools'
import { FILE_OPS_TOOLS } from './agent/tools/implementations/file-ops-tools'
import { WRITING_TOOLS } from './agent/tools/implementations/writing-tools'
import { TASK_MGMT_TOOLS } from './agent/tools/implementations/task-mgmt-tools'
import { AGENT_TOOLS } from './agent/tools/implementations/agent-tools'
import { SKILL_TOOLS } from './agent/tools/implementations/skill-tools'
import { QUESTION_TOOLS } from './agent/tools/implementations/question-tools'
import { PLAN_TOOLS } from './agent/tools/implementations/plan-tools'
import { TODO_TOOLS } from './agent/tools/implementations/todo-tools'
import { EnterpriseDocPlugin } from './plugins/packs/enterprise-doc-plugin'

export async function boot(): Promise<void> {
  // 1. Register built-in skills + file-system skills
  skillRegistry.registerAll(DEMO_SKILLS)
  const fileSkills = await loadSkillsFromDir(process.cwd())
  if (fileSkills.length > 0) skillRegistry.registerAll(fileSkills)
  console.log(`[boot] registered ${skillRegistry.count} skills`)

  // 2. Register built-in tools (core + research + lsp + notification)
  toolRegistry.registerAll([...DEMO_TOOLS, ...RESEARCH_TOOLS, ...LSP_TOOLS, ...NOTIFICATION_TOOLS, ...BASH_TOOLS, ...FILE_OPS_TOOLS, ...WRITING_TOOLS, ...TASK_MGMT_TOOLS, ...AGENT_TOOLS, ...SKILL_TOOLS, ...QUESTION_TOOLS, ...PLAN_TOOLS, ...TODO_TOOLS])
  console.log(`[boot] registered ${toolRegistry.count} tools`)

  // 3. Register built-in hooks
  hookManager.register(confidenceHook)
  hookManager.register(coachingHook)
  hookManager.register(briefHook)
  hookManager.register(memoryHook)
  // Register stop hooks (event-driven pipeline)
  hookPipeline.register(memoryExtractionHook)
  console.log(`[boot] registered ${hookManager.list().length} post-sampling hooks + stop hooks`)

  // 4. Load model configs (before plugins so providers are available)
  const configs = modelConfigService.loadAll()
  console.log(`[boot] loaded ${configs.length} model configs`)

  // 5. Start MCP servers (auto-connect + register tools/skills)
  try {
    const { mcpServerManager } = await import('./agent/mcp/MCPServerManager')
    const mcpResult = await mcpServerManager.boot(process.cwd())
    if (mcpResult.connected.length > 0) {
      console.log(`[boot] MCP servers connected: ${mcpResult.connected.join(', ')}`)
    }
    if (mcpResult.failed.length > 0) {
      console.warn(`[boot] MCP servers failed: ${mcpResult.failed.join(', ')}`)
    }
  } catch (err) { console.warn('[boot] MCP manager init skipped:', err instanceof Error ? err.message : 'unknown') }

  // 6. Boot plugins via PluginLoader
  pluginLoader.registerPack(() => EnterpriseDocPlugin)
  const result = pluginLoader.boot()
  if (result.failed.length > 0) {
    console.warn(`[boot] ${result.failed.length} plugin(s) failed to load`)
  }
  console.log(`[boot] ${result.loaded.length} plugin(s) active`)

  console.log('[boot] boot sequence complete')
}
