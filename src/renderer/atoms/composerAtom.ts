import { atom } from 'jotai'
import { activeActivityAtom } from './activityAtom'

export interface ContextChip {
  id: string
  type: 'file' | 'folder' | 'agent' | 'plugin'
  label: string
  path?: string
}

// ── Per-activity backing stores ──

const _composerValueMap = atom<Record<string, string>>({})
const _isRunningMap = atom<Record<string, boolean>>({})
const _editTextMap = atom<Record<string, string | null>>({})

// ── Derived atoms: route reads/writes by current activity ──

export const composerValueAtom = atom(
  (get) => {
    const map = get(_composerValueMap)
    const activity = get(activeActivityAtom)
    return map[activity] || ''
  },
  (get, set, value: string) => {
    const activity = get(activeActivityAtom)
    set(_composerValueMap, (prev) => ({ ...prev, [activity]: value }))
  },
)

export const isAgentRunningAtom = atom(
  (get) => {
    const map = get(_isRunningMap)
    const activity = get(activeActivityAtom)
    return map[activity] || false
  },
  (get, set, value: boolean) => {
    const activity = get(activeActivityAtom)
    set(_isRunningMap, (prev) => ({ ...prev, [activity]: value }))
  },
)

export const editTextAtom = atom(
  (get) => {
    const map = get(_editTextMap)
    const activity = get(activeActivityAtom)
    return map[activity] ?? null
  },
  (get, set, value: string | null) => {
    const activity = get(activeActivityAtom)
    set(_editTextMap, (prev) => ({ ...prev, [activity]: value }))
  },
)

export const composerChipsAtom = atom<ContextChip[]>([])
