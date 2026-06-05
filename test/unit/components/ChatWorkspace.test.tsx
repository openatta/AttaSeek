import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ChatWorkspace from '@/workspaces/ChatWorkspace'

describe('ChatWorkspace', () => {
  it('renders the Conversation component', () => {
    const { container } = render(<ChatWorkspace />)
    // ChatWorkspace wraps Conversation which contains Composer, SessionHeader, MessageFlow
    expect(container.querySelector('textarea')).toBeInTheDocument()
  })

  it('renders the composer textarea as the primary input', () => {
    const { getByPlaceholderText } = render(<ChatWorkspace />)
    expect(getByPlaceholderText('Ask anything…')).toBeInTheDocument()
  })

  it('is a flex column container', () => {
    const { container } = render(<ChatWorkspace />)
    const conv = container.firstElementChild
    expect(conv?.className).toContain('flex')
    expect(conv?.className).toContain('flex-col')
  })
})
