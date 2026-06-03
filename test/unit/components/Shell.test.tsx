import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'jotai'
import Shell from '@/layouts/Shell'

function renderShell() {
  return render(
    <Provider>
      <Shell />
    </Provider>
  )
}

describe('Shell', () => {
  it('should render the ActivityBar (checking nav labels)', () => {
    renderShell()
    expect(screen.getByLabelText('Home')).toBeInTheDocument()
    expect(screen.getByLabelText('Settings')).toBeInTheDocument()
    const newSessionButtons = screen.getAllByLabelText('New Session')
    expect(newSessionButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('should render the Chat workspace by default', () => {
    renderShell()
    const sessionTitles = screen.getAllByText('New Session')
    expect(sessionTitles.length).toBeGreaterThanOrEqual(1)
  })

  it('should render the SessionHeader', () => {
    renderShell()
    const sessionTitles = screen.getAllByText('New Session')
    expect(sessionTitles.length).toBeGreaterThanOrEqual(1)
  })

  it('should NOT render OutputArea by default (output initially hidden)', () => {
    renderShell()
    // Terminal tab should not be in the document when output is closed
    expect(screen.queryByText('Terminal')).not.toBeInTheDocument()
  })

  it('should show output area toggle button when output is closed', () => {
    renderShell()
    expect(screen.getByLabelText('Show output area')).toBeInTheDocument()
  })

  it('should render Settings when Settings ActivityBar item is clicked', () => {
    renderShell()
    fireEvent.click(screen.getByLabelText('Settings'))
    const generalElements = screen.getAllByText('General')
    expect(generalElements.length).toBeGreaterThanOrEqual(1)
  })
})
