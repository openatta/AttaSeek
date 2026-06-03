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
    // New Session appears in ActivityBar and in Chat workspace (SessionHeader title)
    const newSessionButtons = screen.getAllByLabelText('New Session')
    expect(newSessionButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('should render the Chat workspace by default', () => {
    renderShell()
    // Chat workspace has SessionHeader with "New Session" title text
    const sessionTitles = screen.getAllByText('New Session')
    expect(sessionTitles.length).toBeGreaterThanOrEqual(1)
  })

  it('should render the SessionHeader', () => {
    renderShell()
    const sessionTitles = screen.getAllByText('New Session')
    expect(sessionTitles.length).toBeGreaterThanOrEqual(1)
  })

  it('should render OutputArea terminal tab', () => {
    renderShell()
    expect(screen.getByText('Terminal')).toBeInTheDocument()
  })

  it('should render Settings when Settings ActivityBar item is clicked', () => {
    renderShell()
    fireEvent.click(screen.getByLabelText('Settings'))
    // General appears in both SettingsSidebar button and GeneralSettings heading
    const generalElements = screen.getAllByText('General')
    expect(generalElements.length).toBeGreaterThanOrEqual(1)
  })

  it('should render two main columns: ActivityBar + Workspace', () => {
    renderShell()
    // ActivityBar icons present
    expect(screen.getByLabelText('Home')).toBeInTheDocument()
    // Chat workspace content present
    const sessionTitles = screen.getAllByText('New Session')
    expect(sessionTitles.length).toBeGreaterThanOrEqual(1)
  })
})
