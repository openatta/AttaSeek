import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'jotai'
import SessionHeader from '@/components/Conversation/SessionHeader'

function renderHeader() {
  return render(
    <Provider>
      <SessionHeader />
    </Provider>
  )
}

describe('SessionHeader', () => {
  it('should display "New Session" as the default title', () => {
    renderHeader()
    expect(screen.getByText('New Session')).toBeInTheDocument()
  })

  it('should render the three action buttons', () => {
    renderHeader()
    expect(screen.getByLabelText('Launch app')).toBeInTheDocument()
    expect(screen.getByLabelText('System info')).toBeInTheDocument()
    // outputAreaVisibleAtom defaults to true, so button label is "Hide output area"
    expect(screen.getByLabelText('Hide output area')).toBeInTheDocument()
  })

  it('should have bottom border at 40px height', () => {
    const { container } = renderHeader()
    const header = container.firstChild as HTMLElement
    expect(header.className).toContain('h-[40px]')
    expect(header.className).toContain('border-b')
  })
})
