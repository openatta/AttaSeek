/**
 * ToolResultBudget — enforce per-message size limits on tool results.
 *
 * Runs BEFORE microcompact so cached microcompact (which operates by
 * tool_use_id) sees the same content that the model sees.
 *
 * Tools in the exempt list skip budget enforcement (their results are
 * already bounded by their implementation).
 */

import type { LLMMessage, LLMContentBlock, LLMToolResultBlock } from '../llm/ModelProvider'

/** Maximum characters in a single tool result before replacement. */
const MAX_TOOL_RESULT_CHARS = 50_000

/** Budget enforcement result. */
export interface BudgetResult {
  messages: LLMMessage[]
  /** Number of tool results that were replaced. */
  replacedCount: number
  /** Total characters saved by replacement. */
  charsSaved: number
}

/**
 * Enforce per-message size budget on tool results.
 *
 * Results exceeding MAX_TOOL_RESULT_CHARS are replaced with a truncation
 * notice. The replacement preserves the tool_use_id so subsequent
 * microcompact (which keys on tool_use_id) still works correctly.
 *
 * @param messages — Array of LLM messages to process.
 * @returns BudgetResult with replaced messages.
 */
export function applyToolResultBudget(messages: LLMMessage[]): BudgetResult {
  let replacedCount = 0
  let charsSaved = 0

  const result: LLMMessage[] = messages.map((msg) => {
    if (msg.role !== 'user') return msg
    if (typeof msg.content === 'string') return msg

    const blocks = msg.content as LLMContentBlock[]
    const replaced = blocks.map((block) => {
      if (block.type !== 'tool_result') return block

      const content = block.content
      if (typeof content !== 'string' || content.length <= MAX_TOOL_RESULT_CHARS) {
        return block
      }

      // Replace oversized result with truncation notice
      const truncated = content.slice(0, MAX_TOOL_RESULT_CHARS)
      const remaining = content.length - MAX_TOOL_RESULT_CHARS
      replacedCount++
      charsSaved += remaining

      const newBlock: LLMToolResultBlock = {
        type: 'tool_result',
        tool_use_id: block.tool_use_id,
        content: `${truncated}\n\n[Truncated ${remaining.toLocaleString()} characters — result exceeded budget]`,
      }
      return newBlock
    })

    return { ...msg, content: replaced }
  })

  return { messages: result, replacedCount, charsSaved }
}
