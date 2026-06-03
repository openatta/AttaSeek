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

  it('should render Launch app and System info buttons', () => {
    renderHeader()
    expect(screen.getByLabelText('Launch app')).toBeInTheDocument()
    expect(screen.getByLabelText('System info')).toBeInTheDocument()
  })

  it('should show output area toggle when output is closed (default)', () => {
    renderHeader()
    expect(screen.getByLabelText('Show output area')).toBeInTheDocument()
  })

  it('should show system info popup open by default', () => {
    renderHeader()
    expect(screen.getByText('AttaSeek')).toBeInTheDocument()
  })

  it('should have bottom border at 40px height', () => {
    const { container } = renderHeader()
    const header = container.firstChild as HTMLElement
    expect(header.className).toContain('h-[40px]')
    expect(header.className).toContain('border-b')
  })
})
