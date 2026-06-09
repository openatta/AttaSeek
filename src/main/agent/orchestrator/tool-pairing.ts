/**
 * Shared tool utilities — pairing validation and result content building.
 *
 * These were previously duplicated across query-loop.ts. Extracted into a
 * shared module for reuse by query-loop's runToolBatch.
 */

import type { LLMMessage, LLMToolUseBlock, LLMContentBlock } from '../llm/ModelProvider'
import { TOOL_RESULT_TRUNCATE_LIMIT } from '../../../shared/constants'

/**
 * Validate that every tool_use block in the message history has a matching
 * tool_result. If orphaned tool_use blocks are found, inject synthetic
 * tool_result blocks to prevent Anthropic API 400 errors.
 *
 * @returns Number of orphaned tool_use blocks repaired.
 */
export function validateAndRepairToolPairing(messages: LLMMessage[]): number {
  let repaired = 0

  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i]
    const nextMsg = messages[i + 1]

    // We only care about assistant→user pairs where the assistant has tool_use blocks
    if (msg.role !== 'assistant' || nextMsg.role !== 'user') continue
    if (typeof msg.content === 'string' || typeof nextMsg.content === 'string') continue

    const toolUses = msg.content.filter(
      (b): b is LLMToolUseBlock => b.type === 'tool_use',
    )
    if (toolUses.length === 0) continue

    const toolResultIds = new Set(
      nextMsg.content
        .filter((b): b is { type: 'tool_result'; tool_use_id: string; content: string } => b.type === 'tool_result')
        .map((r) => r.tool_use_id),
    )

    const orphaned = toolUses.filter((tu) => !toolResultIds.has(tu.id))
    if (orphaned.length === 0) continue

    // Repair: inject synthetic tool_result blocks for orphaned tool_use blocks.
    // We inject them as additional blocks in the next (user) message.
    const syntheticBlocks: LLMContentBlock[] = orphaned.map((tu) => ({
      type: 'tool_result' as const,
      tool_use_id: tu.id,
      content: '[tool execution interrupted or permission denied]',
    }))

    // Append synthetic results to the existing user message content
    nextMsg.content = [...nextMsg.content, ...syntheticBlocks]
    repaired += orphaned.length
  }

  return repaired
}

/**
 * Build a tool_result content block from a tool execution result.
 *
 * Truncates output to TOOL_RESULT_TRUNCATE_LIMIT. Used by both
 * query-loop's runToolBatch.
 *
 * @param toolUse — The tool_use block that was executed.
 * @param output  — The tool's output (string or any serializable).
 * @param limit   — Max content length (defaults to TOOL_RESULT_TRUNCATE_LIMIT).
 */
export function buildToolResultBlock(
  toolUse: { id: string; name: string },
  output: unknown,
  limit: number = TOOL_RESULT_TRUNCATE_LIMIT,
): LLMContentBlock {
  const contentStr = typeof output === 'string'
    ? output
    : JSON.stringify(output)
  const truncated = contentStr.length > limit
    ? contentStr.slice(0, limit) + `\n...[truncated ${contentStr.length - limit} chars]`
    : contentStr
  return {
    type: 'tool_result' as const,
    tool_use_id: toolUse.id,
    content: truncated,
  }
}
