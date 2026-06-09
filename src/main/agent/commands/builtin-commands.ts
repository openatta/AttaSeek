/**
 * Built-in command registration.
 * Called once at boot to register all default slash commands.
 */

import { commandRegistry } from './CommandRegistry'
import { modelCommand } from './commands/model-command'
import { compactCommand } from './commands/compact-command'
import { statusCommand } from './commands/status-command'

/** Register all built-in slash commands. Idempotent (safe to call multiple times). */
export function registerBuiltinCommands(): void {
  for (const cmd of [modelCommand, compactCommand, statusCommand]) {
    if (!commandRegistry.get(cmd.name)) {
      commandRegistry.register(cmd)
    }
  }
}
