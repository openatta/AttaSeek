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
  })

  it('should render the sidebar heading with the default activity', () => {
    renderShell()
    // Default activity is 'chat'
    expect(screen.getByText('chat')).toBeInTheDocument()
  })

  it('should render the SessionHeader', () => {
    renderShell()
    expect(screen.getByText('New Session')).toBeInTheDocument()
  })

  it('should render the Composer prompt text', () => {
    renderShell()
    expect(screen.getByText(/@file/)).toBeInTheDocument()
  })

  it('should render the Artifact empty state', () => {
    renderShell()
    expect(screen.getByText('No files open')).toBeInTheDocument()
  })

  it('should switch sidebar content when ActivityBar item is clicked', () => {
    renderShell()
    // Click settings in ActivityBar
    fireEvent.click(screen.getByLabelText('Settings'))
    // Sidebar should now show settings
    expect(screen.getByText('settings')).toBeInTheDocument()
  })

  it('should render four distinct layout regions', () => {
    renderShell()
    // ActivityBar, Sidebar (title + heading), Conversation (header + composer), Artifact
    expect(screen.getByLabelText('Home')).toBeInTheDocument()        // ActivityBar
    expect(screen.getByText('chat')).toBeInTheDocument()             // Sidebar heading
    expect(screen.getByText('New Session')).toBeInTheDocument()      // Conversation: SessionHeader
    expect(screen.getByText('No files open')).toBeInTheDocument()     // Artifact
  })
})
