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
import { WRITING_TOOLS } from './agent/tools/implementations/writing-tools'
import { EnterpriseDocPlugin } from './plugins/packs/enterprise-doc-plugin'

// Tool manifests (LSP + notification manifests for ToolRegistry)
const LSP_TOOLS = [
  { id: 'lsp_diagnostic', name: 'LSP Diagnostic', description: 'Get code diagnostics for a file via Language Server Protocol', riskLevel: 'read' as const, inputSchema: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] }, category: 'lsp' as const },
  { id: 'lsp_definition', name: 'LSP Go to Definition', description: 'Navigate to the definition of a symbol via LSP', riskLevel: 'read' as const, inputSchema: { type: 'object', properties: { filePath: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } }, required: ['filePath', 'line', 'character'] }, category: 'lsp' as const },
  { id: 'lsp_references', name: 'LSP Find References', description: 'Find all references to a symbol via LSP', riskLevel: 'read' as const, inputSchema: { type: 'object', properties: { filePath: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } }, required: ['filePath', 'line', 'character'] }, category: 'lsp' as const },
]
const NOTIFICATION_TOOLS = [
  { id: 'push_notification', name: 'Push Notification', description: 'Send a desktop notification to the user', riskLevel: 'write' as const, inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] }, category: 'notification' as const },
]

export async function boot(): Promise<void> {
  // 1. Register built-in skills + file-system skills
  skillRegistry.registerAll(DEMO_SKILLS)
  const fileSkills = await loadSkillsFromDir(process.cwd())
  if (fileSkills.length > 0) skillRegistry.registerAll(fileSkills)
  console.log(`[boot] registered ${skillRegistry.count} skills`)

  // 2. Register built-in tools (core + research + writing + lsp + notification)
  toolRegistry.registerAll([...DEMO_TOOLS, ...RESEARCH_TOOLS, ...WRITING_TOOLS, ...LSP_TOOLS, ...NOTIFICATION_TOOLS] as any[])
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
