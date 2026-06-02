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

  it('should display a placeholder message for the settings activity', () => {
    render(<Sidebar activity="settings" />)
    expect(screen.getByText('settings')).toBeInTheDocument()
    expect(screen.getByText('Settings — coming soon')).toBeInTheDocument()
  })

  it.each(['home', 'projects', 'search', 'automation', 'plugin'] as Activity[])(
    'should render a placeholder for activity: %s',
    (activity) => {
      render(<Sidebar activity={activity} />)
      expect(screen.getByText(activity)).toBeInTheDocument()
    }
  )
})
