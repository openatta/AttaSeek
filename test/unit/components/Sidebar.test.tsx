import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Sidebar from '@/components/Sidebar/Sidebar'
import type { Activity } from '@/atoms/activityAtom'

describe('Sidebar', () => {
  it('should display the current activity name as a heading', () => {
    render(<Sidebar activity="chat" />)
    expect(screen.getByText('chat')).toBeInTheDocument()
  })

  it('should display a placeholder message for the chat activity', () => {
    render(<Sidebar activity="chat" />)
    expect(screen.getByText('Sessions — coming soon')).toBeInTheDocument()
  })

  it('should render SettingsSidebar when activity is "settings"', () => {
    render(<Sidebar activity="settings" />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
  })

  it('should render ChatsList when activity is "chats"', () => {
    render(<Sidebar activity="chats" />)
    expect(screen.getByPlaceholderText(/搜索/)).toBeInTheDocument()
    expect(screen.getByText('Chats')).toBeInTheDocument()
  })

  it.each(['home', 'projects', 'search', 'automation', 'plugin'] as Activity[])(
    'should render a placeholder for activity: %s',
    (activity) => {
      render(<Sidebar activity={activity} />)
      expect(screen.getByText(activity)).toBeInTheDocument()
    }
  )
})
