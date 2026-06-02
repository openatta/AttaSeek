import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Composer from '@/components/Conversation/Composer'

describe('Composer', () => {
  it('should render a textarea input', () => {
    render(<Composer />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('should render a send button', () => {
    render(<Composer />)
    expect(screen.getByTitle('Send')).toBeInTheDocument()
  })

  it('should show input placeholder text', () => {
    render(<Composer />)
    expect(
      screen.getByPlaceholderText(/Message AttaSeek/)
    ).toBeInTheDocument()
  })

  it('should display mention (@) hint text', () => {
    render(<Composer />)
    expect(screen.getByText(/@file.*@folder.*@agent.*@plugin/)).toBeInTheDocument()
  })

  it('should display slash command hint text', () => {
    render(<Composer />)
    expect(
      screen.getByText(/\/plan.*\/review.*\/explain.*\/fix.*\/diff/)
    ).toBeInTheDocument()
  })

  it('should render input as disabled (placeholder state)', () => {
    render(<Composer />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})
