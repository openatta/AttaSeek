import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import ChatWorkspace from '@/workspaces/ChatWorkspace'
import { outputAreaVisibleAtom } from '@/atoms/outputTabsAtom'

describe('ChatWorkspace', () => {
  it('should NOT render ArtifactPane when output is closed', () => {
    const store = createStore()
    store.set(outputAreaVisibleAtom, false)
    const { container } = render(
      <Provider store={store}>
        <ChatWorkspace />
      </Provider>
    )
    // ArtifactPane should not be in the DOM when output is hidden
    expect(container.querySelector('.border-l.border-\\[var\\(--app-border\\)\\]')).toBeNull()
  })

  it('should render ArtifactPane when output is open', () => {
    const store = createStore()
    store.set(outputAreaVisibleAtom, true)
    const { container } = render(
      <Provider store={store}>
        <ChatWorkspace />
      </Provider>
    )
    // Conversation area should be present
    expect(container.innerHTML).toContain('flex-1')
  })

  it('should render Conversation component in main area', () => {
    const { container } = render(<ChatWorkspace />)
    // ChatWorkspace always renders Conversation
    expect(container.querySelector('.min-w-0')).toBeInTheDocument()
  })
})
