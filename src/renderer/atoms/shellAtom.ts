import { atom } from 'jotai'
import type { OutputTab } from './outputTabsAtom'

/** Layout mode — always 'standard' for MVP */
export const LAYOUT_MODE = 'standard' as const

/** Sidebar width — resizable by drag handle (min 160, max 500) */
export const sidebarWidthAtom = atom(260)

/** Artifact pane width — resizable by drag handle (min 240, max 800) */
export const artifactWidthAtom = atom(400)

/** Per-activity artifact state — persisted across activity switches */
export interface ArtifactSnapshot {
  visible: boolean
  tabs: OutputTab[]
  activeTab: string | null
  fullscreen: boolean
}

const DEFAULT_SNAPSHOT: ArtifactSnapshot = {
  visible: false,
  tabs: [],
  activeTab: null,
  fullscreen: false,
}

/** Map of activity → saved artifact state */
export const artifactStateByActivityAtom = atom<Record<string, ArtifactSnapshot>>({})

export function getArtifactSnapshot(
  state: Record<string, ArtifactSnapshot>,
  activity: string,
): ArtifactSnapshot {
  return state[activity] || DEFAULT_SNAPSHOT
}
