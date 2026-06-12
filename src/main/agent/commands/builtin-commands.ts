/**
 * Built-in command registration.
 * Called once at boot to register all default slash commands.
 */

import { commandRegistry } from './CommandRegistry'
import { modelCommand } from './commands/model-command'
import { compactCommand } from './commands/compact-command'
import { statusCommand } from './commands/status-command'
import { helpCommand } from './commands/help-command'
import { doctorCommand } from './commands/doctor-command'
import { diffCommand } from './commands/diff-command'
import { commitCommand } from './commands/commit-command'
import { costCommand } from './commands/cost-command'
import { exportCommand } from './commands/export-command'
import { prCommand } from './commands/pr-command'
import { reviewCommand } from './commands/review-command'

/** Register all built-in slash commands. Idempotent (safe to call multiple times). */
export function registerBuiltinCommands(): void {
  for (const cmd of [
    modelCommand, compactCommand, statusCommand,
    helpCommand, doctorCommand, diffCommand, commitCommand,
    costCommand, exportCommand, prCommand, reviewCommand,
  ]) {
    if (!commandRegistry.get(cmd.name)) {
      commandRegistry.register(cmd)
    }
  }
}
