/**
 * TaskDecomposer — LLM-driven task decomposition service.
 *
 * Extracted from CoordinatorMode to separate concerns: the coordinator
 * orchestrates subtask execution, while TaskDecomposer handles the LLM
 * call that breaks a goal into ordered subtasks.
 */
import { modelProviderRegistry } from '../llm/ModelProviderRegistry'
import { loadLLMConfig } from '../llm/AttaSettingsLoader'
import { ModelResolver } from '../llm/ModelResolver'
import type { Subtask } from './CoordinatorMode'

/** System prompt for the decompose LLM call. */
const DECOMPOSE_SYSTEM_PROMPT = `You are a task decomposition assistant. Given a goal, break it down into ordered, independent subtasks.

Output as a JSON array of subtasks. Each subtask has:
- "title": short title (5-8 words)
- "goal": complete self-contained description for a worker agent
- "profileId": one of "explore" (research/read-only), "plan" (design/planning), "review" (code review), "verify" (testing), "coding" (implementation), "research" (web research), "writing" (documentation)
- "dependsOn": array of indices of subtasks this depends on (0-indexed)

Rules:
- Research subtasks should have no dependencies and run in parallel
- Implementation subtasks depend on research being complete
- Verification subtasks depend on implementation being complete
- Use "explore" for code investigation, "coding" for code changes, "verify" for testing
- Prefer fewer, larger subtasks over many tiny ones
- Use dependsOn to express ordering constraints

Return ONLY the JSON array, no other text.`

export class TaskDecomposer {
  /**
   * Decompose a goal into subtasks via LLM.
   *
   * Uses the compact model (low cost, fast) to break down complex goals
   * into dependency-ordered subtasks. Returns null when LLM is unavailable
   * or decomposition fails — caller should fall back to single-subtask.
   */
  async decompose(goal: string): Promise<Subtask[] | null> {
    try {
      const llmConfig = loadLLMConfig()
      if (!llmConfig.provider) return null

      const resolver = new ModelResolver(llmConfig.provider)
      const compactModel = resolver.compact()
      if (!compactModel) return null

      const provider = modelProviderRegistry.getDefault()
      if (!provider) return null

      const decomposeAc = new AbortController()
      const decomposeTimeout = setTimeout(() => decomposeAc.abort(), 30_000)
      try {
        const result = await provider.chat({
          systemPrompt: DECOMPOSE_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: `Goal: ${goal}` }],
            },
          ],
          tools: [],
          signal: decomposeAc.signal,
          model: compactModel,
        })
        clearTimeout(decomposeTimeout)

        const textContent = result.content
          .filter((b) => b.type === 'text')
          .map((b) => ('text' in b ? b.text : ''))
          .join('')

        const parsed = this.parseDecomposition(textContent)
        if (parsed && parsed.length > 0) {
          return parsed
        }
      } finally {
        clearTimeout(decomposeTimeout)
      }
    } catch (err) {
      console.warn('[TaskDecomposer] LLM decompose failed:',
        err instanceof Error ? err.message : String(err))
    }

    return null
  }

  /** Parse LLM decomposition response into Subtask[]. */
  private parseDecomposition(text: string): Subtask[] | null {
    try {
      const trimmed = text.trim()
      let jsonStr = trimmed

      // Extract JSON array if wrapped in markdown code block
      const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1]!.trim()
      }

      // Find the JSON array boundaries if mixed with other text
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/)
      if (arrayMatch) {
        jsonStr = arrayMatch[0]!
      }

      const parsed = JSON.parse(jsonStr) as unknown[]
      if (!Array.isArray(parsed) || parsed.length === 0) return null

      return parsed.map((item: unknown) => {
        const obj = item as Record<string, unknown>
        return {
          title: String(obj.title || obj.goal || 'Subtask'),
          goal: String(obj.goal || obj.title || 'No goal specified'),
          profileId: String(obj.profileId || 'coding'),
          dependsOn: Array.isArray(obj.dependsOn)
            ? obj.dependsOn.map(Number).filter((n) => !isNaN(n))
            : undefined,
        }
      })
    } catch {
      return null
    }
  }
}

export const taskDecomposer = new TaskDecomposer()
