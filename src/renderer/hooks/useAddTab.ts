/**
 * useAddTab — creates a new AP tab and activates it.
 *
 * Deduplicates the tab creation logic that was repeated in
 * ApEmptyState and ApTabBar.
 */

import { useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { apTabsAtom, activeApTabAtom } from '../components/Artifact/ApAtoms'
import { listPanes, type PaneType } from '../components/Artifact/PaneRegistry'

function generateTabId(): string {
  return `ap-tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function useAddTab(): (paneType: PaneType, customLabel?: string, customId?: string) => void {
  const setTabs = useSetAtom(apTabsAtom)
  const setActiveTab = useSetAtom(activeApTabAtom)

  return useCallback(
    (paneType: PaneType, customLabel?: string, customId?: string) => {
      const reg = listPanes().find((p) => p.type === paneType)
      const id = customId || generateTabId()
      const label = customLabel || reg?.label || paneType
      setTabs((prev) => [...prev, { id, paneType, label }])
      setActiveTab(id)
    },
    [setTabs, setActiveTab],
  )
}
