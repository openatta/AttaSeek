import { useAtomValue } from 'jotai'
import { activeActivityAtom } from '../atoms/activityAtom'
import { sidebarWidthAtom } from '../atoms/shellAtom'
import { getPrimarySidebarView } from '../registries/sidebarRegistry'

export default function SidebarSlot() {
  const activeActivity = useAtomValue(activeActivityAtom)
  const sidebarWidth = useAtomValue(sidebarWidthAtom)
  const sidebarView = getPrimarySidebarView(activeActivity)
  const SidebarContent = sidebarView?.component

  if (!SidebarContent) return null

  return (
    <div
      className="flex flex-col h-full flex-shrink-0 border-r border-[var(--app-border)] bg-[var(--app-sidebar-bg)]"
      style={{ width: sidebarWidth }}
    >
      <div className="flex-shrink-0 h-[40px]" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <SidebarContent />
      </div>
    </div>
  )
}
