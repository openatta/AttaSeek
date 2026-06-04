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
    expect(screen.getByLabelText('New Session')).toBeInTheDocument()
  })

  it('should render the Dashboard (home) workspace by default', () => {
    renderShell()
    // Dashboard shows stat cards
    expect(screen.getByText('Conversations')).toBeInTheDocument()
  })

  it('should show Quick Start on dashboard', () => {
    renderShell()
    expect(screen.getByPlaceholderText('What do you want to build?')).toBeInTheDocument()
  })

  it('should NOT render ArtifactPane by default (output initially hidden)', () => {
    renderShell()
    expect(screen.queryByText('Hide panel')).not.toBeInTheDocument()
  })

  it('should render Settings when Settings ActivityBar item is clicked', () => {
    renderShell()
    fireEvent.click(screen.getByLabelText('Settings'))
    const generalElements = screen.getAllByText('General')
    expect(generalElements.length).toBeGreaterThanOrEqual(1)
  })
})
