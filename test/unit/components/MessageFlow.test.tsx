import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MessageFlow from '@/components/Conversation/MessageFlow'

describe('MessageFlow', () => {
  it('should display the welcome prompt in empty state', () => {
    render(<MessageFlow />)
    expect(screen.getByText('What can I help with?')).toBeInTheDocument()
  })

  it('should render without crashing', () => {
    const { container } = render(<MessageFlow />)
    expect(container).toBeTruthy()
  })

  it('should have a scrollable container', () => {
    const { container } = render(<MessageFlow />)
    expect(container.querySelector('.overflow-y-auto')).toBeInTheDocument()
  })

  it('should render the welcome message centered', () => {
    const { container } = render(<MessageFlow />)
    const center = container.querySelector('.text-center')
    expect(center).toBeInTheDocument()
    expect(center?.textContent).toContain('What can I help with?')
  })
})
