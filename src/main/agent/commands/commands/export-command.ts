/**
 * /export command — export the current session as Markdown.
 *
 * Usage:
 *   /export              → export to ~/Desktop/attaseek-export-{sessionId}.md
 *   /export <path>       → export to specified file path
 *
 * Local-only command (shouldQuery: false).
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import type { SlashCommand } from '../CommandRegistry'
import type { LLMMessage } from '../../llm/ModelProvider'

function formatMessages(messages: LLMMessage[]): string {
  const lines: string[] = ['# AttaSeek Session Export\n']
  for (const msg of messages) {
    const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1)
    let content = ''
    if (typeof msg.content === 'string') {
      content = msg.content
    } else if (Array.isArray(msg.content)) {
      content = msg.content.map(block => {
        if (block.type === 'text') {
          return block.text
        }
        if (block.type === 'tool_use') {
          return `\`[Tool: ${block.name}]\`\n\`\`\`json\n${JSON.stringify(block.input, null, 2)}\n\`\`\``
        }
        if (block.type === 'tool_result') {
          return `\`[Result]\`\n${block.content.slice(0, 2000)}`
        }
        return `[unknown]`
      }).join('\n\n')
    }
    lines.push(`## ${role}\n\n${content}\n`)
  }
  return lines.join('\n')
}

export const exportCommand: SlashCommand = {
  name: 'export',
  description: 'Export the current session to a Markdown file',

  execute(args: string, ctx) {
    const trimmed = args.trim()
    const outputPath = trimmed || join(homedir(), 'Desktop', `attaseek-export-${ctx.sessionId.slice(0, 8)}.md`)
    const markdown = formatMessages(ctx.messages)

    try {
      const dir = dirname(outputPath)
      mkdirSync(dir, { recursive: true })
      writeFileSync(outputPath, markdown, 'utf-8')
      return {
        messages: [],
        shouldQuery: false,
        resultText: `✅ Session exported to \`${outputPath}\` (${ctx.messages.length} messages, ${(markdown.length / 1024).toFixed(1)} KB)`,
      }
    } catch (err) {
      return {
        messages: [],
        shouldQuery: false,
        resultText: `❌ Export failed: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  },
}
