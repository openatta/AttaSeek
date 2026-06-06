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
import { llmProviderRegistry } from '../llm/LLMProviderRegistry'

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

export async function extractMemories(
  messages: LLMMessage[],
  goal: string,
  sessionId: string,
  projectId?: string,
  _projectRoot?: string,
): Promise<MemoryEntry[]> {
  const newEntries: MemoryEntry[] = []

  // Always record task completion
  const taskContent = `Completed: ${goal}`
  let existingContent = new Set<string>()
  try { existingContent = new Set(memoryService.listAll().map(e => e.content)) } catch { /* DB may not be available */ }
  if (!existingContent.has(taskContent)) {
    try {
      const entry = memoryService.store({
        scope: 'project', scopeId: projectId || sessionId,
        type: 'task_state', content: taskContent,
        source: 'auto_extract',
        sessionId, taskId: '',
      })
      newEntries.push(entry)
    } catch { /* best effort */ }
  }

  // Try LLM-powered extraction first
  const allText = messages
    .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
    .join('\n')

  let extractedFacts: string[] = []
  try {
    const provider = llmProviderRegistry.getDefault()
    if (provider) {
      const result = await provider.chat({
        systemPrompt: EXTRACT_MEMORIES_PROMPT,
        messages: [
          { role: 'user', content: `Goal: ${goal}\n\nConversation:\n${allText.slice(0, 20_000)}` },
        ],
        tools: [],
      })
      const text = result.content.filter(b => b.type === 'text').map(b => (b as any).text).join('\n')
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        extractedFacts = JSON.parse(jsonMatch[1]).map((f: any) => f.content).filter(Boolean)
      }
    }
  } catch { /* LLM extraction failed — fall back to heuristics below */ }

  // Heuristic fallback (when LLM unavailable or fails)
  if (extractedFacts.length === 0) {
    const patterns = [
      { regex: /prefer[s]?\s+(?:to\s+)?(use|using)\s+([^.,]+)/gi },
      { regex: /(?:convention|pattern)\s+(?:is|:)\s+([^.,]+)/gi },
      { regex: /(?:decided|chose|selected)\s+(?:to\s+)?([^.,]+)/gi },
    ]
    for (const { regex } of patterns) {
      let match
      while ((match = regex.exec(allText)) !== null) {
        const content = match[2] || match[1]
        if (content && content.length > 10 && content.length < 500) {
          extractedFacts.push(content.trim())
        }
      }
    }
  }

  // Deduplicate and store
  for (const fact of extractedFacts) {
    if (!existingContent.has(fact)) {
      try {
        const entry = memoryService.store({
          scope: 'project', scopeId: projectId || sessionId,
          type: 'user_preference', content: fact,
          source: 'auto_extract',
          sessionId, taskId: '',
        })
        newEntries.push(entry)
        existingContent.add(fact)
      } catch { /* best effort */ }
    }
  }

  return newEntries
}
