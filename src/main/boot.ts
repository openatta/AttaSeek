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
import { loadSkillsFromDir } from './agent/skills/SkillLoader'
import { DEMO_SKILLS } from './skills/packs/demo-pack'
import { DEMO_TOOLS } from './tools/packs/demo-tools'
import { RESEARCH_TOOLS } from './agent/tools/implementations/research-tools'
import { LSP_TOOLS } from './agent/tools/implementations/lsp-tools'
import { NOTIFICATION_TOOLS } from './agent/tools/implementations/notification-tools'
import { EnterpriseDocPlugin } from './plugins/packs/enterprise-doc-plugin'

export async function boot(): Promise<void> {
  // 1. Register built-in skills + file-system skills
  skillRegistry.registerAll(DEMO_SKILLS)
  const fileSkills = await loadSkillsFromDir(process.cwd())
  if (fileSkills.length > 0) skillRegistry.registerAll(fileSkills)
  console.log(`[boot] registered ${skillRegistry.count} skills`)

  // 2. Register built-in tools (core + research + lsp + notification)
  toolRegistry.registerAll([...DEMO_TOOLS, ...RESEARCH_TOOLS, ...LSP_TOOLS, ...NOTIFICATION_TOOLS] as any[])
  console.log(`[boot] registered ${toolRegistry.count} tools`)

  // 3. Register built-in hooks
  hookManager.register(confidenceHook)
  hookManager.register(coachingHook)
  hookManager.register(briefHook)
  hookManager.register(memoryHook)
  console.log(`[boot] registered ${hookManager.list().length} hooks`)

  // 4. Load model configs (before plugins so providers are available)
  modelConfigService.loadAll()
  console.log(`[boot] loaded ${modelConfigService.listAll().length} model configs`)

  // 5. Start MCP servers (if configured — currently discovery-only)
  try {
    const { mcpServerManager } = await import('./agent/mcp/MCPServerManager')
    console.log(`[boot] MCP server manager ready (${mcpServerManager.listServers().length} servers)`)
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
