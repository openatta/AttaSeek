import { atom } from 'jotai'
import type { OutputTab } from './outputTabsAtom'

/** Sidebar width — resizable by drag handle (min 160, max 500) */
export const sidebarWidthAtom = atom(260)

/** Artifact pane width — resizable by drag handle (min 240, max 800) */
export const artifactWidthAtom = atom(400)

/**
 * Per-activity artifact content panel state — persisted across activity switches.
 *
 * NOTE: OutputTab here refers to artifact content tabs (code/markdown/svg etc.),
 * NOT Pane tool tabs (browser/terminal/file/review). See outputTabsAtom.ts for
 * the two-tab-system distinction.
 */
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

/** Map of activity → saved artifact content panel state */
export const artifactStateByActivityAtom = atom<Record<string, ArtifactSnapshot>>({})

export function getArtifactSnapshot(
  state: Record<string, ArtifactSnapshot>,
  activity: string,
): ArtifactSnapshot {
  return state[activity] || DEFAULT_SNAPSHOT
}
