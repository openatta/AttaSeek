/**
 * Model Configure — shared types usable by both main and renderer processes.
 */

export interface ModelConfig {
  id: string
  name: string
  interfaceType: 'openai_compatible' | 'anthropic'
  endpointUrl: string
  models: string[]
  defaultModel: string
  extraParams?: Record<string, unknown>
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

export interface CreateModelConfig {
  name: string
  interfaceType: 'openai_compatible' | 'anthropic'
  endpointUrl: string
  apiKey: string
  models: string[]
  defaultModel: string
  extraParams?: Record<string, unknown>
}

export interface UsageStats {
  totalInput: number
  totalOutput: number
  byModel: { model: string; inputTokens: number; outputTokens: number }[]
  byDay: { date: string; inputTokens: number; outputTokens: number }[]
}
