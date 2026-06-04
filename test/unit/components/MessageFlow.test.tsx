import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MessageFlow from '@/components/Conversation/MessageFlow'

describe('MessageFlow', () => {
  it('should display the app name', () => {
    render(<MessageFlow />)
    expect(screen.getByText('AttaSeek Agent Workbench')).toBeInTheDocument()
  })

  it('should display an empty-state prompt', () => {
    render(<MessageFlow />)
    expect(
      screen.getByText(/Type a message below/)
    ).toBeInTheDocument()
  })

  it('should display instructions on what the agent can do', () => {
    render(<MessageFlow />)
    expect(
      screen.getByText(/plan, execute tools, and generate artifacts/)
    ).toBeInTheDocument()
  })

  it('should render an icon placeholder', () => {
    render(<MessageFlow />)
    const icon = document.querySelector('.rounded-2xl')
    expect(icon).toBeInTheDocument()
  })
})
