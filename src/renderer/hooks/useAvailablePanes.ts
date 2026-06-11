/**
 * useAvailablePanes — returns the list of panes available in the current context.
 *
 * Filters by:
 * - Context: CHATS vs project (requireProject constraint)
 * - Single-instance: file/browser/review filtered out if already open
 *
 * Used by ApEmptyState (big buttons) and ApTabBar ([+] menu).
 */

import { useAtomValue } from 'jotai'
import { apContextAtom, browserInstanceAtom, fileInstanceAtom, reviewInstanceAtom, projectRootAtom } from '../components/Artifact/ApAtoms'
import { listPanes, type PaneRegistration } from '../components/Artifact/PaneRegistry'

export function useAvailablePanes(): PaneRegistration[] {
  const context = useAtomValue(apContextAtom)
  const hasBrowser = useAtomValue(browserInstanceAtom)
  const hasFile = useAtomValue(fileInstanceAtom)
  const hasReview = useAtomValue(reviewInstanceAtom)
  const projectRoot = useAtomValue(projectRootAtom)

  const instanceMap: Record<string, boolean> = {
    browser: hasBrowser,
    file: hasFile,
    review: hasReview,
  }

  return listPanes().filter((p) => {
    if (p.constraints.requireProject && !(context === 'project' && projectRoot)) return false
    if (p.constraints.singleInstance && instanceMap[p.type]) return false
    return true
  })
}
