/**
 * ApAtoms — AP-level Jotai atoms for the Artifact Pane Tab system.
 *
 * This is the canonical home for all AP-related atoms.
 * outputTabsAtom.ts re-exports the visibility/fullscreen atoms
 * under their legacy names for backward compatibility.
 */

import { atom } from 'jotai'
import type { PaneType } from './PaneRegistry'

export interface ApTab {
  id: string
  paneType: PaneType
  label: string
}

/** List of open Pane tabs in the AP */
export const apTabsAtom = atom<ApTab[]>([])

/** Currently active (visible) AP tab ID */
export const activeApTabAtom = atom<string | null>(null)

/** Current application context */
export type ApContext = 'chats' | 'project'

export const apContextAtom = atom<ApContext>('chats')

/** Whether a browser Pane instance is currently open (single-instance guard) */
export const browserInstanceAtom = atom(false)

/** Project root path — null when no project is open */
export const projectRootAtom = atom<string | null>(null)

/** AP panel visibility (canonical — replaces outputAreaVisibleAtom) */
export const apVisibleAtom = atom(false)

/** AP panel fullscreen mode (canonical — replaces outputFullscreenAtom) */
export const apFullscreenAtom = atom(false)
