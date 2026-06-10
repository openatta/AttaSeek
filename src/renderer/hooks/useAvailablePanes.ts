/**
 * useAvailablePanes — returns the list of panes available in the current context.
 *
 * Filters by:
 * - Context: CHATS vs project (requireProject constraint)
 * - Single-instance: browser doesn't appear if already open
 *
 * Used by ApEmptyState (big buttons) and ApTabBar ([+] menu).
 */

import { useAtomValue } from 'jotai'
import { apContextAtom, browserInstanceAtom, projectRootAtom } from '../components/Artifact/ApAtoms'
import { listPanes, type PaneRegistration } from '../components/Artifact/PaneRegistry'

export function useAvailablePanes(): PaneRegistration[] {
  const context = useAtomValue(apContextAtom)
  const hasBrowser = useAtomValue(browserInstanceAtom)
  const projectRoot = useAtomValue(projectRootAtom)

  return listPanes().filter((p) => {
    if (p.constraints.requireProject && !(context === 'project' && projectRoot)) return false
    if (p.constraints.singleInstance && p.type === 'browser' && hasBrowser) return false
    return true
  })
}
