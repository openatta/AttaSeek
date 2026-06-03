import { useState } from 'react'
import Settings from '../components/Settings/Settings'
import SettingsSidebar from '../components/Settings/SettingsSidebar'

/**
 * Settings workspace — 2-zone:
 *   [Left: settings nav]  [Main: settings content]
 */
export default function SettingsWorkspace() {
  const [sidebarWidth, setSidebarWidth] = useState(220)

  return (
    <div className="flex flex-1 min-w-0">
      <div
        className="flex-shrink-0 border-r border-[var(--app-border)] overflow-y-auto flex flex-col"
        style={{ width: sidebarWidth, minWidth: 180, maxWidth: 320 }}
      >
        <div
          className="flex-shrink-0 h-[40px] flex items-center px-4"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <h2 className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">
            SETTINGS
          </h2>
        </div>
        <SettingsSidebar />
      </div>
      <Settings />
    </div>
  )
}
