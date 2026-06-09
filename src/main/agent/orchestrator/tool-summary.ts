/**
 * tool-summary — Background tool-use summary generation.
 *
 * After tool execution completes, asynchronously generates a compact
 * summary of what each tool did using a fast model (Haiku / small_fast).
 * The summary is consumed before the next LLM call to save context space.
 *
 * Mirrors Claude Code's toolUseSummaryGenerator in src/services/toolUseSummary/.
 */

import type { LLMMessage, LLMContentBlock, LLMToolUseBlock } from '../llm/ModelProvider'

// ── Types ──

export interface ToolUseSummaryEntry {
  toolCallId: string
  toolName: string
  /** One-line description of what the tool did. */
  action: string
  /** One-line description of the result. */
  result: string
  /** Original tool result content (truncated). */
  truncatedContent?: string
}

export interface ToolUseSummary {
  turnIndex: number
  toolUses: ToolUseSummaryEntry[]
  /** Total characters saved by replacing tool results with summary. */
  charsSaved: number
}

// ── Heuristic fallback (no LLM call needed) ──

/**
 * Generate a heuristic tool-use summary without making an LLM call.
 *
 * Rules-based extraction:
 *   - file reads  → shows filename + line count
 *   - grep/search → shows match count
 *   - bash        → shows exit status + first/last line
 *   - web_fetch   → shows URL + content length
 *   - file writes → shows path + bytes written
 *   - others      → truncates result content
 *
 * This is the default approach — LLM-based summarization (using the
 * compact model) is an optional upgrade for Phase C+.
 */
export function generateToolUseSummary(
  toolUseBlocks: LLMToolUseBlock[],
  toolResultBlocks: LLMContentBlock[],
  turnIndex: number,
): ToolUseSummary {
  const entries: ToolUseSummaryEntry[] = []
  let charsSaved = 0

  for (const tu of toolUseBlocks) {
    const resultBlock = toolResultBlocks.find(
      (b) => b.type === 'tool_result' && b.tool_use_id === tu.id,
    ) as { type: 'tool_result'; tool_use_id: string; content: string } | undefined

    const rawContent = resultBlock?.content ?? '[no result]'
    const truncatedContent = rawContent.length > 3000
      ? rawContent.slice(0, 3000) + '...'
      : rawContent

    const entry = summarizeByHeuristic(tu, rawContent)
    entries.push(entry)

    // Track savings: we replace long tool results with short summaries
    const summaryLen = entry.action.length + entry.result.length
    charsSaved += Math.max(0, rawContent.length - summaryLen)
  }

  return { turnIndex, toolUses: entries, charsSaved }
}

/** Build the summary message to insert into the conversation. */
export function buildToolUseSummaryMessage(
  summary: ToolUseSummary,
  messageId: string,
): LLMMessage | null {
  if (summary.toolUses.length === 0) return null

  const lines = summary.toolUses.map(
    (e) => `- **${e.toolName}** (${e.toolCallId}): ${e.action} → ${e.result}`,
  )

  return {
    role: 'user',
    content: `[Tool use summary — turn ${summary.turnIndex}]\n${lines.join('\n')}`,
  }
}

// ── Heuristic summarizers ──

function summarizeByHeuristic(
  toolUse: LLMToolUseBlock,
  content: string,
): ToolUseSummaryEntry {
  const input = toolUse.input as Record<string, unknown> | undefined

  switch (toolUse.name) {
    case 'read_file': {
      const path = String(input?.filePath ?? input?.file_path ?? '?')
      const lines = content.split('\n').length
      return {
        toolCallId: toolUse.id,
        toolName: toolUse.name,
        action: `read \`${path}\``,
        result: `${lines} lines returned`,
        truncatedContent: content.slice(0, 3000),
      }
    }

    case 'write_file': {
      const path = String(input?.filePath ?? input?.file_path ?? '?')
      const bytes = content.length
      return {
        toolCallId: toolUse.id,
        toolName: toolUse.name,
        action: `wrote \`${path}\``,
        result: `${bytes.toLocaleString()} bytes written`,
        truncatedContent: content.slice(0, 500),
      }
    }

    case 'edit_file': {
      const path = String(input?.filePath ?? input?.file_path ?? '?')
      return {
        toolCallId: toolUse.id,
        toolName: toolUse.name,
        action: `edited \`${path}\``,
        result: `edit applied`,
        truncatedContent: content.slice(0, 500),
      }
    }

    case 'grep':
    case 'search_code':
    case 'search_content': {
      const pattern = String(input?.pattern ?? input?.query ?? '?')
      const matchCount = (content.match(/^\/.*?:/gm) || []).length
      return {
        toolCallId: toolUse.id,
        toolName: toolUse.name,
        action: `searched for "${pattern}"`,
        result: matchCount > 0 ? `${matchCount} matches found` : 'no matches',
        truncatedContent: content.slice(0, 2000),
      }
    }

    case 'glob': {
      const pattern = String(input?.pattern ?? input?.glob ?? '?')
      const fileCount = content.trim().split('\n').filter(Boolean).length
      return {
        toolCallId: toolUse.id,
        toolName: toolUse.name,
        action: `globbed "${pattern}"`,
        result: `${fileCount} files matched`,
        truncatedContent: content.slice(0, 1000),
      }
    }

    case 'bash': {
      const exitMatch = content.match(/exit code:\s*(\d+)/i)
      const exitCode = exitMatch ? exitMatch[1] : '?'
      const firstLine = content.trim().split('\n')[0]?.slice(0, 120) || ''
      const lastLine = content.trim().split('\n').pop()?.slice(0, 120) || ''
      return {
        toolCallId: toolUse.id,
        toolName: toolUse.name,
        action: `ran: \`${String(input?.command ?? '?').slice(0, 80)}\``,
        result: exitCode === '0'
          ? `ok (${firstLine.slice(0, 60)}${firstLine.length > 60 ? '…' : ''})`
          : `exit ${exitCode}: ${lastLine.slice(0, 60)}`,
        truncatedContent: content.slice(0, 2000),
      }
    }

    case 'web_fetch': {
      const url = String(input?.url ?? '?')
      const len = content.length
      const title = content.match(/^#\s*(.+)/m)?.[1] || content.trim().slice(0, 80)
      return {
        toolCallId: toolUse.id,
        toolName: toolUse.name,
        action: `fetched ${url.slice(0, 60)}`,
        result: `${len.toLocaleString()} chars — "${title.slice(0, 60)}"`,
        truncatedContent: content.slice(0, 2000),
      }
    }

    case 'web_search': {
      const query = String(input?.query ?? '?').slice(0, 60)
      const resultCount = (content.match(/^\d+\.\s|^-\s|^•\s/gm) || []).length
      return {
        toolCallId: toolUse.id,
        toolName: toolUse.name,
        action: `searched web: "${query}"`,
        result: `${resultCount || '?'} results`,
        truncatedContent: content.slice(0, 2000),
      }
    }

    case 'lsp_diagnostic':
    case 'lsp_definition':
    case 'lsp_references': {
      const file = String(input?.filePath ?? input?.file_path ?? '?')
      return {
        toolCallId: toolUse.id,
        toolName: toolUse.name,
        action: `LSP ${toolUse.name.replace('lsp_', '')} at \`${file}\``,
        result: content.slice(0, 120),
        truncatedContent: content.slice(0, 1000),
      }
    }

    default: {
      // Generic truncation for any unknown tool
      const summary = content.length > 200
        ? content.slice(0, 200).replace(/\n/g, ' ') + '…'
        : content.replace(/\n/g, ' ')
      return {
        toolCallId: toolUse.id,
        toolName: toolUse.name,
        action: `${toolUse.name} executed`,
        result: summary,
        truncatedContent: content.slice(0, 2000),
      }
    }
  }
}

// ── Async LLM-based summary (fire-and-forget upgrade) ──

/**
 * Generate tool-use summaries using a small/fast LLM model.
 *
 * Used when there are >2 tool calls — uses the compact model for
 * higher-quality, context-aware summaries. Falls back to heuristic
 * summarization if the LLM call fails or times out.
 *
 * @param toolUseBlocks — the tool_use blocks from the assistant response
 * @param toolResultBlocks — the corresponding tool_result blocks
 * @param turnIndex — current turn number
 * @param model — the small/fast model to use for summarization
 * @param timeoutMs — max wait for the LLM call (default 5000ms)
 */
export async function generateLLMToolUseSummary(
  toolUseBlocks: LLMToolUseBlock[],
  toolResultBlocks: LLMContentBlock[],
  turnIndex: number,
  model: string,
  timeoutMs = 5000,
): Promise<ToolUseSummary> {
  // Build a compact input for the summarizer model — only send truncated
  // tool results to keep the summarization call cheap
  const toolDescriptions = toolUseBlocks.map((tu) => {
    const resultBlock = toolResultBlocks.find(
      (b) => b.type === 'tool_result' && b.tool_use_id === tu.id,
    ) as { type: 'tool_result'; tool_use_id: string; content: string } | undefined
    const content = resultBlock?.content ?? '[no result]'
    const truncated = content.length > 1200 ? content.slice(0, 1200) + '...' : content
    return { toolCallId: tu.id, toolName: tu.name, input: tu.input, result: truncated }
  })

  const systemPrompt = `You are a tool output summarizer. For each tool call below, produce:
- "action": a one-line description of what the tool did (present tense, max 80 chars)
- "result": a one-line description of the outcome (past tense, max 80 chars)

Return ONLY a JSON array with this exact format:
[{"toolCallId": "...", "toolName": "...", "action": "...", "result": "..."}]`

  const userMessage = toolDescriptions.map((td) =>
    `Tool: ${td.toolName} (id: ${td.toolCallId})\nInput: ${JSON.stringify(td.input).slice(0, 300)}\nOutput: ${td.result}`
  ).join('\n\n---\n\n')

  try {
    // Dynamically import to avoid circular deps
    const { modelProviderRegistry } = await import('../llm/ModelProviderRegistry')

    const provider = modelProviderRegistry.getDefault()
    if (!provider) throw new Error('No provider available')

    const result = await Promise.race([
      provider.chat({
        systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        tools: [],
        model,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM summary timed out')), timeoutMs),
      ),
    ])

    const text = result.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('\n')

    // Parse JSON — try multiple strategies
    let parsed: Array<{ toolCallId: string; toolName: string; action: string; result: string }> = []
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1])
    } else {
      // Try raw JSON
      const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/)
      if (arrayMatch) {
        parsed = JSON.parse(arrayMatch[0])
      }
    }

    // Map back to ToolUseSummaryEntry, falling back to heuristic for missing entries
    const entries: ToolUseSummaryEntry[] = []
    let charsSaved = 0
    for (const tu of toolUseBlocks) {
      const llmEntry = parsed.find((p) => p.toolCallId === tu.id)
      if (llmEntry) {
        const rawContent = toolResultBlocks.find(
          (b) => b.type === 'tool_result' && b.tool_use_id === tu.id,
        ) as { type: 'tool_result'; tool_use_id: string; content: string } | undefined
        const rawLen = (rawContent?.content ?? '').length
        entries.push({
          toolCallId: tu.id,
          toolName: tu.name,
          action: llmEntry.action,
          result: llmEntry.result,
          truncatedContent: rawContent?.content?.slice(0, 3000),
        })
        charsSaved += Math.max(0, rawLen - (llmEntry.action.length + llmEntry.result.length))
      } else {
        // Fall back to heuristic for this specific tool
        const found = toolResultBlocks.find(
          (b) => b.type === 'tool_result' && b.tool_use_id === tu.id,
        ) as { type: 'tool_result'; tool_use_id: string; content: string } | undefined
        const heuristic = summarizeByHeuristic(tu, found?.content ?? '')
        entries.push(heuristic)
      }
    }

    return { turnIndex, toolUses: entries, charsSaved }
  } catch {
    // Fall back to heuristic summarization on any error
    return generateToolUseSummary(toolUseBlocks, toolResultBlocks, turnIndex)
  }
}
