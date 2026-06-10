/**
 * ApPaneHost — looks up the correct Pane component by paneType and renders it.
 * Acts as the bridge between the AP Tab system and individual Pane implementations.
 */

import { getPane } from './PaneRegistry'
import { ErrorBoundary } from './ErrorBoundary'
import type { ApTab } from './ApAtoms'

interface ApPaneHostProps {
  tab: ApTab
}

export default function ApPaneHost({ tab }: ApPaneHostProps) {
  const registration = getPane(tab.paneType)

  if (!registration) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--app-text-tertiary)]">
        <div className="text-center">
          <div className="text-2xl mb-2">❓</div>
          <div>Unknown pane type: {tab.paneType}</div>
        </div>
      </div>
    )
  }

  const PaneComponent = registration.component
  return (
    <ErrorBoundary fallbackLabel={`Pane "${registration.label}" encountered an error`}>
      <PaneComponent apTabId={tab.id} />
    </ErrorBoundary>
  )
}
