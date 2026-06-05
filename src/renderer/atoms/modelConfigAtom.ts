/**
 * Model Config atoms — frontend projection of configured LLM providers.
 * Loaded from main process via IPC on startup.
 * Types re-exported from shared/types/model (canonical source).
 */

import { atom } from 'jotai'
import type { UsageStats } from '../../shared/types/model'

export type { ModelConfig, CreateModelConfig, UsageStats } from '../../shared/types/model'

/** All configured model providers (loaded from main process) */
export const modelConfigsAtom = atom<ModelConfig[]>([])

/** Currently selected model config ID for the active conversation (null = use default) */
export const activeModelIdAtom = atom<string | null>(null)

/** Currently selected model name for the active conversation (null = use defaultModel) */
export const activeModelNameAtom = atom<string | null>(null)

/** Derived: whether any model is configured */
export const hasModelConfiguredAtom = atom((get) => get(modelConfigsAtom).length > 0)

/** Usage stats for the currently viewed config */
export const modelUsageAtom = atom<UsageStats | null>(null)
