/**
 * Boot sequence — registers skills, tools, and plugins before renderer starts.
 * Called once from main/index.ts.
 */

import { skillRegistry } from './skills/SkillRegistry'
import { toolRegistry } from './tools/ToolRegistry'
import { pluginLoader } from './plugins/PluginLoader'
import { modelConfigService } from './model/ModelConfigService'
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

  // 3. Load model configs (before plugins so providers are available)
  modelConfigService.loadAll()
  console.log(`[boot] loaded ${modelConfigService.listAll().length} model configs`)

  // 4. Boot plugins via PluginLoader (handles registration + activation + error recovery)
  pluginLoader.registerPack(() => EnterpriseDocPlugin)
  const result = pluginLoader.boot()
  if (result.failed.length > 0) {
    console.warn(`[boot] ${result.failed.length} plugin(s) failed to load`)
  }
  console.log(`[boot] ${result.loaded.length} plugin(s) active`)

  console.log('[boot] boot sequence complete')
}
