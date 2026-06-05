/**
 * ModelUsageTracker — records and queries LLM token usage via SQL.
 */

import { getDb } from '../store/db'
import { newId } from '../store/id'

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

export class ModelUsageTracker {
  /** Record a single LLM call's token usage */
  record(params: UsageRecord): void {
    const db = getDb()
    const id = `tu_${newId()}`
    const now = Date.now()
    db.prepare(`INSERT INTO token_usage (id, config_id, session_id, task_id, model, input_tokens, output_tokens, created_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      id, params.configId, params.sessionId || null, params.taskId || null,
      params.model, params.inputTokens, params.outputTokens, now,
    )
  }

  /** Get usage summary — uses SQL GROUP BY for efficiency */
  summary(configId?: string, periodDays?: number): UsageSummary {
    const db = getDb()

    const conditions: string[] = []
    const params: any[] = []
    if (configId) { conditions.push('config_id = ?'); params.push(configId) }
    if (periodDays) {
      conditions.push('created_at >= ?')
      params.push(Date.now() - periodDays * 86400000)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Total
    const totals = db.prepare(
      `SELECT COALESCE(SUM(input_tokens),0) AS total_in, COALESCE(SUM(output_tokens),0) AS total_out FROM token_usage ${where}`
    ).get(...params) as any

    // By model
    const byModel = db.prepare(
      `SELECT model, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens FROM token_usage ${where} GROUP BY model ORDER BY SUM(input_tokens+output_tokens) DESC`
    ).all(...params) as any[]

    // By day (SQLite: group by date from unix timestamp ms)
    const byDay = db.prepare(
      `SELECT DATE(created_at / 1000, 'unixepoch') AS date, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens FROM token_usage ${where} GROUP BY date ORDER BY date DESC LIMIT 30`
    ).all(...params) as any[]

    return {
      totalInput: totals?.total_in || 0,
      totalOutput: totals?.total_out || 0,
      byModel: byModel.map((r: any) => ({ model: r.model, inputTokens: r.input_tokens, outputTokens: r.output_tokens })),
      byDay: byDay.map((r: any) => ({ date: r.date, inputTokens: r.input_tokens, outputTokens: r.output_tokens })),
    }
  }
}

export const modelUsageTracker = new ModelUsageTracker()
