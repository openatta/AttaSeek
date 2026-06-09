/**
 * ModelUsageTracker — records and queries LLM token usage via plaintext JSONL.
 * Stored at ~/.atta/seek/token_usage.jsonl.
 */

import { JSONLStore } from '../store/FileStore'
import { newId } from '../store/id'
import { dataDir } from '../store/paths'

const store = new JSONLStore(`${dataDir()}/token_usage.jsonl`)

export interface UsageRecord {
  configId: string
  sessionId?: string
  taskId?: string
  model: string
  inputTokens: number
  outputTokens: number
}

export interface UsageSummary {
  totalInput: number
  totalOutput: number
  byModel: { model: string; inputTokens: number; outputTokens: number }[]
  byDay: { date: string; inputTokens: number; outputTokens: number }[]
}

interface UsageEntry extends UsageRecord {
  id: string
  createdAt: number
}

export class ModelUsageTracker {
  /** Record a single LLM call's token usage */
  async record(params: UsageRecord): Promise<void> {
    const id = `tu_${newId()}`
    const now = Date.now()
    await store.append({ id, ...params, createdAt: now })
  }

  /** Get usage summary — computes aggregations in memory */
  async summary(configId?: string, periodDays?: number): Promise<UsageSummary> {
    let totalInput = 0
    let totalOutput = 0
    const byModelMap = new Map<string, { inputTokens: number; outputTokens: number }>()
    const byDayMap = new Map<string, { inputTokens: number; outputTokens: number }>()

    const cutoff = periodDays ? Date.now() - periodDays * 86400000 : 0

    for await (const e of store.read()) {
      const entry = e as UsageEntry
      if (configId && entry.configId !== configId) continue
      if (periodDays && entry.createdAt < cutoff) continue

      totalInput += entry.inputTokens
      totalOutput += entry.outputTokens

      // By model
      const modelKey = entry.model || 'unknown'
      const m = byModelMap.get(modelKey) || { inputTokens: 0, outputTokens: 0 }
      m.inputTokens += entry.inputTokens
      m.outputTokens += entry.outputTokens
      byModelMap.set(modelKey, m)

      // By day
      const date = new Date(entry.createdAt).toISOString().slice(0, 10)
      const d = byDayMap.get(date) || { inputTokens: 0, outputTokens: 0 }
      d.inputTokens += entry.inputTokens
      d.outputTokens += entry.outputTokens
      byDayMap.set(date, d)
    }

    return {
      totalInput,
      totalOutput,
      byModel: Array.from(byModelMap.entries())
        .map(([model, v]) => ({ model, ...v }))
        .sort((a, b) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens)),
      byDay: Array.from(byDayMap.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30),
    }
  }
}

export const modelUsageTracker = new ModelUsageTracker()
