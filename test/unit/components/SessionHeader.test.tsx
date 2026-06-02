import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SessionHeader from '@/components/Conversation/SessionHeader'

describe('SessionHeader', () => {
  it('should display "New Session" as the default title', () => {
    render(<SessionHeader />)
    expect(screen.getByText('New Session')).toBeInTheDocument()
  })

  it('should display a model selector', () => {
    render(<SessionHeader />)
    expect(screen.getByText(/Opus/)).toBeInTheDocument()
  })

  it('should display a permission mode selector', () => {
    render(<SessionHeader />)
    expect(screen.getByText(/Auto/)).toBeInTheDocument()
  })

  it('should render app shortcut buttons (Terminal, Diff, Browser)', () => {
    render(<SessionHeader />)
    const buttons = screen.getAllByRole('button')
    // Should have at least the 3 app buttons
    expect(buttons.length).toBeGreaterThanOrEqual(3)
  })
})
