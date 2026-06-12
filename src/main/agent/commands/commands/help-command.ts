/**
 * /help command — list all available slash commands.
 *
 * Usage:
 *   /help       → show all commands
 *   /help diff  → show details for /diff
 */

import type { SlashCommand } from '../CommandRegistry'
import { commandRegistry } from '../CommandRegistry'

export const helpCommand: SlashCommand = {
  name: 'help',
  description: 'Show available slash commands',
  aliases: ['h', '?'],

  execute(args: string) {
    const trimmed = args.trim()
    const allCmds = commandRegistry.list().sort((a, b) => a.name.localeCompare(b.name))

    // Show details for a specific command
    if (trimmed) {
      const cmdName = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
      const cmd = commandRegistry.get(cmdName)
      if (!cmd) {
        return {
          messages: [],
          shouldQuery: false,
          resultText: `Unknown command: /${cmdName}. Use /help to see all commands.`,
        }
      }
      const lines = [
        `**/${cmd.name}** — ${cmd.description}`,
        cmd.aliases && cmd.aliases.length > 0 ? `\nAliases: ${cmd.aliases.map(a => `/${a}`).join(', ')}` : '',
      ]
      return { messages: [], shouldQuery: false, resultText: lines.join('\n') }
    }

    // List all commands
    const lines = ['**Available commands:**', '']
    for (const cmd of allCmds) {
      const aliases = cmd.aliases && cmd.aliases.length > 0
        ? ` (${cmd.aliases.map(a => `/${a}`).join(', ')})`
        : ''
      lines.push(`- **/${cmd.name}**${aliases} — ${cmd.description}`)
    }
    lines.push('', 'Use `/help <command>` for details.')

    return { messages: [], shouldQuery: false, resultText: lines.join('\n') }
  },
}
