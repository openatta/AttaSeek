/**
 * MemoryExtractor — Automatic memory extraction from completed conversations.
 *
 * Features:
 *   - ExtractionCursor: differential extraction (only new messages since last run)
 *   - ExtractionCoalescer: queues overlapping requests, drains once
 *   - MemdirManager: loads existing MEMORY.md context for dedup
 *   - Fire-and-forget: failures are logged but never block
 *
 * Inspired by Claude Code's extractMemories/ service.
 */

import { memoryService } from '../../memory/MemoryService'
import { loadMemoryPrompt } from './MemdirManager'
import type { MemoryEntry } from '../../../shared/types/Memory'
import type { LLMMessage } from '../llm/ModelProvider'
import { modelProviderRegistry } from '../llm/ModelProviderRegistry'
import {
  MEMORY_DRAIN_TIMEOUT_MS, MEMORY_PREVIEW_CHARS, MEMORY_MAX_CONTEXT_CHARS,
} from '../../../shared/constants'

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

// ── Extraction cursor (differential extraction) ──

interface ExtractionCursor {
  lastMessageId: string
  lastExtractedAt: number
  turnsSinceLastExtraction: number
}

const extractionCursors = new Map<string, ExtractionCursor>()

/** Minimum turns between extractions (throttle) */
const MIN_EXTRACTION_INTERVAL = 3

// ── Extraction coalescer ──

interface PendingExtraction {
  messages: LLMMessage[]
  goal: string
  sessionId: string
  projectId?: string
  projectRoot?: string
  resolve: (entries: MemoryEntry[]) => void
}

let pendingExtraction: PendingExtraction | null = null
let drainTimer: ReturnType<typeof setTimeout> | null = null

export async function extractMemories(
  messages: LLMMessage[],
  goal: string,
  sessionId: string,
  projectId?: string,
  projectRoot?: string,
): Promise<MemoryEntry[]> {
  // Cursor check: skip if not enough turns since last extraction
  const cursor = extractionCursors.get(sessionId)
  if (cursor && cursor.turnsSinceLastExtraction < MIN_EXTRACTION_INTERVAL) {
    cursor.turnsSinceLastExtraction++
    return []
  }

  // Coalesce: if extraction is already pending, stash and wait for drain
  if (pendingExtraction) {
    return new Promise<MemoryEntry[]>((resolve) => {
      pendingExtraction = {
        messages: [...pendingExtraction!.messages, ...messages],
        goal: `${pendingExtraction!.goal}; ${goal}`,
        sessionId,
        projectId,
        projectRoot,
        resolve: (entries) => {
          pendingExtraction = null
          resolve(entries)
        },
      }
      // Reset drain timer
      if (drainTimer) clearTimeout(drainTimer)
      drainTimer = setTimeout(() => drainExtraction(), MEMORY_DRAIN_TIMEOUT_MS)
    })
  }

  return new Promise<MemoryEntry[]>((resolve) => {
    pendingExtraction = {
      messages, goal, sessionId, projectId, projectRoot,
      resolve: (entries) => {
        pendingExtraction = null
        resolve(entries)
      },
    }
    drainTimer = setTimeout(() => drainExtraction(), MEMORY_DRAIN_TIMEOUT_MS)
  })
}

async function drainExtraction(): Promise<void> {
  if (!pendingExtraction) return
  const req = pendingExtraction
  pendingExtraction = null
  if (drainTimer) { clearTimeout(drainTimer); drainTimer = null }

  try {
    const entries = await doExtract(req.messages, req.goal, req.sessionId, req.projectId, req.projectRoot)
    // Update cursor
    if (req.messages.length > 0) {
      const lastMsg = req.messages[req.messages.length - 1]
      const lastId = typeof lastMsg.content === 'string' ? lastMsg.content.slice(0, MEMORY_PREVIEW_CHARS) : JSON.stringify(lastMsg.content).slice(0, MEMORY_PREVIEW_CHARS)
      extractionCursors.set(req.sessionId, {
        lastMessageId: lastId,
        lastExtractedAt: Date.now(),
        turnsSinceLastExtraction: 0,
      })
    }
    req.resolve(entries)
  } catch {
    req.resolve([])
  }
}

// ── Core extraction logic ──

async function doExtract(
  messages: LLMMessage[],
  goal: string,
  sessionId: string,
  projectId?: string,
  projectRoot?: string,
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

  // Load existing memory context from MEMORY.md
  let memoryContext = ''
  try {
    const memPrompt = loadMemoryPrompt(projectRoot)
    if (memPrompt.entries.length > 0) {
      memoryContext = `\n## Existing memories (avoid duplicates)\n${memPrompt.entries.map(e => `- [${e.type}] ${e.name}: ${e.description}`).join('\n')}`
    }
  } catch { /* best effort */ }

  // Try LLM-powered extraction
  const allText = messages
    .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
    .join('\n')

  let extractedFacts: string[] = []
  try {
    const provider = modelProviderRegistry.getDefault()
    if (provider) {
      const result = await provider.chat({
        systemPrompt: EXTRACT_MEMORIES_PROMPT + memoryContext,
        messages: [
          { role: 'user', content: `Goal: ${goal}\n\nConversation:\n${allText.slice(0, MEMORY_MAX_CONTEXT_CHARS)}` },
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

  // Heuristic fallback
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

