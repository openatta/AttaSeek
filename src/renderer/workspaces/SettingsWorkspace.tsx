import Settings from '../components/Settings/Settings'

/**
 * Settings workspace — single zone.
 * Left sidebar (settings nav) is handled by WorkspaceSidebar.
 */
export default function SettingsWorkspace() {
  return (
    <div className="flex-1 min-w-0">
      <Settings />
    </div>
  )
}
