/**
 * SessionMemory — auto-maintained, per-session memory layer (L1).
 *
 * Maintains a session-memory.md file that is incrementally updated
 * during a conversation session. Uses the compact model for low-cost
 * periodic summarization of key information.
 *
 * Inspired by Claude Code's SessionMemory service
 * (src/services/SessionMemory/sessionMemory.ts).
 *
 * Architecture:
 *   L0: FileMemory (CLAUDE.md + .atta/seek/memories/*.md) — persistent, user-managed
 *   L1: SessionMemory (.atta/seek/sessions/{id}/session-memory.md) — auto-maintained
 *   L2: MemoryExtractor (SQLite) — cross-session durable extraction
 */

import * as fs from 'fs'
import * as path from 'path'
import { dataDir } from '../../store/paths'
import type { LLMMessage } from '../llm/ModelProvider'

// ── Config ──

const SESSION_MEMORY_MAX_BYTES = 50_000 // 50KB max
const SESSION_MEMORY_UPDATE_INTERVAL = 5 // turns between updates
const SESSION_MEMORY_SUMMARY_CHARS = 2000 // chars to send to summary model

// ── Types ──

export interface SessionMemoryState {
  sessionId: string
  /** Number of turns since last update */
  turnsSinceUpdate: number
  /** The current session memory content */
  content: string
  /** File path to the session-memory.md */
  filePath: string
  /** Epoch ms of last update */
  lastUpdatedAt: number
}

// ── In-memory state (per session) ──

const sessionStates = new Map<string, SessionMemoryState>()

/**
 * Initialize or load session memory for a session.
 * Called at the start of each query.
 */
export function initSessionMemory(sessionId: string): SessionMemoryState {
  const existing = sessionStates.get(sessionId)
  if (existing) return existing

  const filePath = getSessionMemoryPath(sessionId)
  let content = ''
  try {
    content = fs.readFileSync(filePath, 'utf-8').slice(0, SESSION_MEMORY_MAX_BYTES)
  } catch { /* file doesn't exist yet — start fresh */ }

  const state: SessionMemoryState = {
    sessionId,
    turnsSinceUpdate: 0,
    content,
    filePath,
    lastUpdatedAt: Date.now(),
  }
  sessionStates.set(sessionId, state)
  return state
}

/**
 * Check if session memory should be updated and do so if needed.
 * Called between turns in the query loop. Uses the compact model
 * to generate an incremental update.
 *
 * Returns the updated content (or existing if not yet due).
 */
export async function maybeUpdateSessionMemory(
  sessionId: string,
  messages: LLMMessage[],
  goal: string,
  model: string,
): Promise<string> {
  const state = initSessionMemory(sessionId)
  state.turnsSinceUpdate++

  if (state.turnsSinceUpdate < SESSION_MEMORY_UPDATE_INTERVAL) {
    return state.content
  }

  // Reset counter
  state.turnsSinceUpdate = 0

  try {
    const { modelProviderRegistry } = await import('../llm/ModelProviderRegistry')
    const provider = modelProviderRegistry.getDefault()
    if (!provider) return state.content

    // Take a sample of the most recent conversation
    const recentMessages = messages.slice(-8) // last 4 turn-pairs
    const conversationSample = recentMessages
      .map(m => {
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        return `${m.role}: ${content}`
      })
      .join('\n')
      .slice(0, SESSION_MEMORY_SUMMARY_CHARS)

    const existingSection = state.content
      ? `## Existing session memory\n${state.content.slice(0, 2000)}\n\n`
      : ''

    const systemPrompt = `You are a session memory maintainer. Given the existing session memory and new conversation, produce an UPDATED session memory (incremental update — keep existing info, add new facts).

Focus on:
1. Key decisions made
2. Important facts shared
3. User preferences expressed
4. Project conventions mentioned
5. Work in progress

Write in concise bullet points. Keep the total under 300 words. Do NOT repeat information that is already captured and unchanged.

Return ONLY the updated session memory text, no other commentary.`

    const result = await provider.chat({
      systemPrompt,
      messages: [{
        role: 'user',
        content: `${existingSection}## Recent conversation\nGoal: ${goal}\n\n${conversationSample}`,
      }],
      tools: [],
      model,
    })

    const newContent = result.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('\n')
      .slice(0, SESSION_MEMORY_MAX_BYTES)

    // Persist to disk
    state.content = newContent
    state.lastUpdatedAt = Date.now()
    try {
      const dir = path.dirname(state.filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(state.filePath, newContent, 'utf-8')
    } catch { /* best effort — memory continues in-memory */ }

    return newContent
  } catch {
    // Failure is non-blocking — return existing content
    return state.content
  }
}

/**
 * Get the current session memory content (for prompt injection).
 */
export function getSessionMemoryContent(sessionId: string): string {
  const state = sessionStates.get(sessionId)
  if (!state || !state.content) return ''
  return `\n## Session Context\n${state.content}\n`
}

/**
 * Get the file path for a session's memory file.
 */
export function getSessionMemoryPath(sessionId: string): string {
  return path.join(dataDir(), 'sessions', sessionId, 'session-memory.md')
}

/**
 * Clear session memory state for a session (on session close).
 */
export function clearSessionMemory(sessionId: string): void {
  sessionStates.delete(sessionId)
}
