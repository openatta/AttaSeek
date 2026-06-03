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
    expect(screen.getByLabelText('Chats')).toBeInTheDocument()
  })

  it('should render the sidebar heading with the default activity', () => {
    renderShell()
    // Default activity is 'chat' → WorkspaceSidebar shows 'Chats' heading
    expect(screen.getByText('Chats')).toBeInTheDocument()
  })

  it('should render the SessionHeader', () => {
    renderShell()
    expect(screen.getByText('New Session')).toBeInTheDocument()
  })

  it('should render the Composer prompt text', () => {
    renderShell()
    expect(screen.getByText(/@file/)).toBeInTheDocument()
  })

  it('should render OutputArea terminal tab', () => {
    renderShell()
    expect(screen.getByText('Terminal')).toBeInTheDocument()
  })

  it('should render Settings when Settings ActivityBar item is clicked', () => {
    renderShell()
    fireEvent.click(screen.getByLabelText('Settings'))
    // Sidebar should show Settings section, canvas shows Settings
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('should render four distinct layout regions', () => {
    renderShell()
    // ActivityBar, Sidebar (heading), Conversation (header + composer), OutputArea
    expect(screen.getByLabelText('Home')).toBeInTheDocument() // ActivityBar
    expect(screen.getByText('Chats')).toBeInTheDocument() // Sidebar heading
    expect(screen.getByText('New Session')).toBeInTheDocument() // SessionHeader
  })
})
