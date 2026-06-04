import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'jotai'
import ActivityBar from '@/components/ActivityBar/ActivityBar'

function renderBar() {
  return render(
    <Provider>
      <ActivityBar />
    </Provider>
  )
}

describe('ActivityBar', () => {
  it('should render 6 top-level nav items and Settings', () => {
    renderBar()
    expect(screen.getByLabelText('Home')).toBeInTheDocument()
    expect(screen.getByLabelText('New Session')).toBeInTheDocument()
    expect(screen.getByLabelText('Search')).toBeInTheDocument()
    expect(screen.getByLabelText('Automation')).toBeInTheDocument()
    expect(screen.getByLabelText('Plugins')).toBeInTheDocument()
    expect(screen.getByLabelText('Projects')).toBeInTheDocument()
    expect(screen.getByLabelText('Settings')).toBeInTheDocument()
  })

  it('should mark the default activity (home) as active', () => {
    renderBar()
    const homeBtn = screen.getByLabelText('Home')
    expect(homeBtn.className).toContain('text-blue-400')
  })

  it('should switch to settings when settings button is clicked', () => {
    renderBar()
    const settingsBtn = screen.getByLabelText('Settings')
    fireEvent.click(settingsBtn)
    expect(settingsBtn.className).toContain('text-blue-400')
  })

  it('should switch to home when home button is clicked', () => {
    renderBar()
    const homeBtn = screen.getByLabelText('Home')
    fireEvent.click(homeBtn)
    expect(homeBtn.className).toContain('text-blue-400')
  })

  it('should deactivate the previous item when a new one is clicked', () => {
    renderBar()
    const homeBtn = screen.getByLabelText('Home')
    const chatBtn = screen.getByLabelText('New Session')

    expect(homeBtn.className).toContain('text-blue-400')
    fireEvent.click(chatBtn)
    expect(homeBtn.className).not.toContain('text-blue-400')
    expect(chatBtn.className).toContain('text-blue-400')
  })
})
