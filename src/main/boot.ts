/**
 * Boot sequence — registers all built-in skills, tools, and plugins
 * before the renderer starts. Called once from main/index.ts.
 */

import { skillRegistry } from './skills/SkillRegistry'
import { toolRegistry } from './tools/ToolRegistry'
import { pluginRegistry } from './plugins/PluginRegistry'
import { DEMO_SKILLS } from './skills/packs/demo-pack'
import { DEMO_TOOLS } from './tools/packs/demo-tools'
import { EnterpriseDocPlugin } from './plugins/packs/enterprise-doc-plugin'

export function boot(): void {
  // 1. Register built-in skills
  skillRegistry.registerAll(DEMO_SKILLS)
  console.log(`[boot] registered ${skillRegistry.count} skills`)

  // 2. Register built-in tools
  toolRegistry.registerAll(DEMO_TOOLS)
  console.log(`[boot] registered ${toolRegistry.count} tools`)

  // 3. Register built-in plugins
  pluginRegistry.register(EnterpriseDocPlugin)
  pluginRegistry.activate('enterprise-doc')
  console.log(`[boot] registered ${pluginRegistry.count} plugins`)

  console.log('[boot] boot sequence complete')
}
