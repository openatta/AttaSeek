import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkspaceSidebar } from '@/layouts/WorkspaceRouter'
import type { Activity } from '@/atoms/activityAtom'

describe('WorkspaceSidebar', () => {
  it('should display the Chats heading for "chat" activity', () => {
    render(<WorkspaceSidebar activity="chat" />)
    expect(screen.getByText('Chats')).toBeInTheDocument()
  })

  it('should display the Chats heading for "chats" activity', () => {
    render(<WorkspaceSidebar activity="chats" />)
    expect(screen.getByText('Chats')).toBeInTheDocument()
  })

  it('should render SettingsSidebar when activity is "settings"', () => {
    render(<WorkspaceSidebar activity="settings" />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
  })

  it('should render ChatsList when activity is "chats"', () => {
    render(<WorkspaceSidebar activity="chats" />)
    expect(screen.getByPlaceholderText(/搜索/)).toBeInTheDocument()
  })

  it.each([
    { activity: 'home' as Activity, heading: 'Dashboard' },
    { activity: 'projects' as Activity, heading: 'Projects' },
    { activity: 'search' as Activity, heading: 'Search' },
    { activity: 'automation' as Activity, heading: 'Automation' },
    { activity: 'plugin' as Activity, heading: 'Plugins' }
  ])(
    'should render a placeholder for activity: $activity',
    ({ activity, heading }) => {
      render(<WorkspaceSidebar activity={activity} />)
      expect(screen.getByText(heading)).toBeInTheDocument()
    }
  )
})
