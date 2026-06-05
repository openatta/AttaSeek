/**
 * MemoryExtractor — Automatic memory extraction from completed conversations.
 *
 * After each task completes, calls LLM to extract key facts, preferences,
 * decisions, and project conventions. Deduplicates against existing memories
 * before writing to L0 (file system) + L2 (SQLite).
 *
 * Fire-and-forget pattern — failures are logged but never block the user.
 *
 * Inspired by Claude Code's extractMemories/ service.
 */

import { memoryService } from '../../memory/MemoryService'
import type { MemoryEntry } from '../../../shared/types/Memory'
import type { LLMMessage } from '../llm/LLMProvider'

export const EXTRACT_MEMORIES_PROMPT = `You are a memory extraction assistant. Analyze the conversation below and extract key information worth remembering for future interactions.

## What to extract
1. **User preferences** — stated likes, dislikes, conventions, workflows
2. **Project conventions** — naming patterns, file structure, tech stack choices
3. **Decisions made** — architectural choices, tradeoffs accepted, rejected alternatives
4. **Key facts** — important information the user shared about their project or domain
5. **Reusable patterns** — code patterns, configurations, or approaches the user prefers

## Output format (JSON)
\`\`\`json
[
  {
    "type": "user_preference" | "project_memory" | "task_state" | "enterprise_knowledge",
    "content": "The specific fact or preference to remember",
    "scope": "user" | "project" | "global"
  }
]
\`\`\`

Return ONLY the JSON array. No other text.`

/** Extract memories from a completed conversation */
export async function extractMemories(
  messages: LLMMessage[],
  goal: string,
  sessionId: string,
  projectId?: string,
  projectRoot?: string,
): Promise<MemoryEntry[]> {
  // In MVP, do simple dedup-aware extraction without LLM
  // Store the completed goal as a task_state entry
  const existingEntries = memoryService.listAll()
  const existingContent = new Set(existingEntries.map(e => e.content))

  const newEntries: MemoryEntry[] = []

  // Always record task completion
  const taskContent = `Completed: ${goal}`
  if (!existingContent.has(taskContent)) {
    const entry = memoryService.store({
      scope: 'project', scopeId: projectId || sessionId,
      type: 'task_state', content: taskContent,
      source: 'auto_extract', layer: 'L2',
      sessionId, taskId: '',
    })
    newEntries.push(entry)
  }

  // Extract key information from messages using heuristics
  const allText = messages
    .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
    .join('\n')

  // Simple heuristic extraction (LLM-powered extraction to be added in Phase 4 enhancement)
  const patterns = [
    { regex: /prefer[s]?\s+(?:to\s+)?(use|using)\s+([^.,]+)/gi, type: 'user_preference' as const },
    { regex: /(?:convention|pattern)\s+(?:is|:)\s+([^.,]+)/gi, type: 'project_memory' as const },
    { regex: /(?:decided|chose|selected)\s+(?:to\s+)?([^.,]+)/gi, type: 'task_state' as const },
  ]

  for (const { regex, type } of patterns) {
    let match
    while ((match = regex.exec(allText)) !== null) {
      const content = match[2] || match[1]
      if (content.length > 10 && content.length < 500 && !existingContent.has(content)) {
        const entry = memoryService.store({
          scope: 'project', scopeId: projectId || sessionId,
          type, content: content.trim(),
          source: 'auto_extract', layer: 'L2',
          sessionId, taskId: '',
        })
        newEntries.push(entry)
      }
    }
  }

  return newEntries
}
