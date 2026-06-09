/**
 * CommandRegistry — slash command processing for the query loop.
 *
 * Commands run BEFORE the query loop. They can modify the message array,
 * switch the model, update tool permissions, or bypass the LLM entirely
 * (shouldQuery: false for local-only commands like /status).
 *
 * Mirrors Claude Code's processUserInput() slash-command handling
 * (src/utils/processUserInput/processUserInput.js).
 *
 * Lifecycle:
 *   1. User types "/model opus"
 *   2. QueryEngine.submitMessage() calls processUserInput()
 *   3. CommandRegistry runs the matching command
 *   4. The command returns { messages, shouldQuery, modelOverride, ... }
 *   5. QueryEngine applies the mutations and decides whether to enter queryLoop
 */

import type { LLMMessage } from '../llm/ModelProvider'

// ── Types ──

export interface CommandContext {
  /** Current session ID. */
  sessionId: string
  /** Current task ID. */
  taskId: string
  /** Current conversation messages (may be empty for first turn). */
  messages: LLMMessage[]
  /** Current working directory. */
  cwd: string
}

export interface CommandResult {
  /** Messages to inject into the conversation. Appended before queryLoop. */
  messages: LLMMessage[]
  /** Whether to proceed to the query loop. false = return resultText directly. */
  shouldQuery: boolean
  /** Optional model override (e.g., "/model opus" switches to claude-opus-4-8). */
  modelOverride?: string
  /** Text result to return when shouldQuery is false (local commands). */
  resultText?: string
  /** Optional tool allowlist update (command names to allow). */
  allowedTools?: string[]
}

export interface SlashCommand {
  /** Command name without the leading slash (e.g., "model", "compact", "status"). */
  name: string
  /** Short description shown in help text. */
  description: string
  /** Command aliases (e.g., "m" for "model"). */
  aliases?: string[]
  /**
   * Execute the command.
   * @param args — Everything after the command name (trimmed).
   * @param ctx  — Current command context.
   */
  execute(args: string, ctx: CommandContext): Promise<CommandResult> | CommandResult
}

// ── Registry ──

export class CommandRegistry {
  private commands = new Map<string, SlashCommand>()
  private aliases = new Map<string, string>()

  /** Register a slash command. */
  register(cmd: SlashCommand): void {
    this.commands.set(cmd.name, cmd)
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        this.aliases.set(alias, cmd.name)
      }
    }
  }

  /** Unregister a command by name. */
  unregister(name: string): void {
    const cmd = this.commands.get(name)
    if (!cmd) return
    this.commands.delete(name)
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        if (this.aliases.get(alias) === name) {
          this.aliases.delete(alias)
        }
      }
    }
  }

  /** Get a command by name or alias. */
  get(name: string): SlashCommand | undefined {
    return this.commands.get(name) ?? this.commands.get(this.aliases.get(name) ?? '')
  }

  /** List all registered commands. */
  list(): SlashCommand[] {
    return [...this.commands.values()]
  }

  /**
   * Process user input through the command pipeline.
   *
   * If the input starts with "/", try to match a command and execute it.
   * Otherwise, pass through as a regular message.
   *
   * @param input — Raw user input string.
   * @param ctx   — Current command context.
   * @returns The command result, or null if no command matched (treat as regular input).
   */
  async processUserInput(input: string, ctx: CommandContext): Promise<CommandResult | null> {
    const trimmed = input.trim()
    if (!trimmed.startsWith('/')) return null

    // Parse: "/command args"
    const spaceIdx = trimmed.indexOf(' ')
    const cmdName = spaceIdx === -1
      ? trimmed.slice(1)
      : trimmed.slice(1, spaceIdx)
    const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim()

    const cmd = this.get(cmdName)
    if (!cmd) return null // Unknown command — pass through to LLM

    return await cmd.execute(args, ctx)
  }
}

// ── Singleton ──

/** Global command registry. Populated at boot with built-in commands. */
export const commandRegistry = new CommandRegistry()
