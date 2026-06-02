import { useAtom } from 'jotai'
import { activeActivityAtom } from '../atoms/activityAtom'
import ActivityBar from '../components/ActivityBar/ActivityBar'
import TitleBar from '../components/TitleBar/TitleBar'
import Sidebar from '../components/Sidebar/Sidebar'
import Conversation from '../components/Conversation/Conversation'
import Settings from '../components/Settings/Settings'
import OutputArea from '../components/OutputArea/OutputArea'

export default function Shell() {
  const [activeActivity] = useAtom(activeActivityAtom)

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Activity Bar — 48px left rail */}
      <ActivityBar />

      {/* Sidebar region: title bar (traffic lights area) + sidebar content */}
      <div
        className="flex flex-col flex-shrink-0 border-r border-neutral-800"
        style={{ width: 'var(--sidebar-width)' }}
      >
        <TitleBar />
        <Sidebar activity={activeActivity} />
      </div>

      {/* Main Canvas: Conversation (center) + AI OutputArea (right) */}
      <div className="flex flex-1 min-w-0">
        {/* Conversation / Settings — primary content area */}
        <div className="flex flex-col flex-1 min-w-0">
          {activeActivity === 'settings' ? <Settings /> : <Conversation />}
        </div>

        {/* AI Output area — right panel */}
        <OutputArea />
      </div>
    </div>
  )
}
