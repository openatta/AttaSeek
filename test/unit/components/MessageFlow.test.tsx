import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MessageFlow from '@/components/Conversation/MessageFlow'

describe('MessageFlow', () => {
  it('should display the app name', () => {
    render(<MessageFlow />)
    expect(screen.getByText('AttaSeek Agent')).toBeInTheDocument()
  })

  it('should display an empty-state prompt', () => {
    render(<MessageFlow />)
    expect(
      screen.getByText(/Start a conversation/)
    ).toBeInTheDocument()
  })

  it('should display instructions on what the agent can do', () => {
    render(<MessageFlow />)
    expect(
      screen.getByText(/read code, write patches, run commands, or review changes/)
    ).toBeInTheDocument()
  })

  it('should render an icon placeholder', () => {
    render(<MessageFlow />)
    // The diamond icon ◈
    const icon = document.querySelector('.rounded-2xl')
    expect(icon).toBeInTheDocument()
  })
})
