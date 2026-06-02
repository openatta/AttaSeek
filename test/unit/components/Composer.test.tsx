import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'jotai'
import Composer from '@/components/Conversation/Composer'

function renderComposer() {
  return render(
    <Provider>
      <Composer />
    </Provider>
  )
}

describe('Composer', () => {
  it('should render a textarea input', () => {
    renderComposer()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('should render a send button', () => {
    renderComposer()
    expect(screen.getByLabelText('Send')).toBeInTheDocument()
  })

  it('should show input placeholder text', () => {
    renderComposer()
    expect(screen.getByPlaceholderText(/Message AttaSeek/)).toBeInTheDocument()
  })

  it('should display mention (@) hint text', () => {
    renderComposer()
    expect(screen.getByText(/@file.*@folder.*@agent.*@plugin/)).toBeInTheDocument()
  })

  it('should display slash command hint text', () => {
    renderComposer()
    expect(screen.getByText(/\/plan.*\/review.*\/explain.*\/fix.*\/diff/)).toBeInTheDocument()
  })

  it('should render model selector', () => {
    renderComposer()
    expect(screen.getByText(/Opus/)).toBeInTheDocument()
  })

  it('should render a textarea (enabled for interactive use)', () => {
    renderComposer()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})
