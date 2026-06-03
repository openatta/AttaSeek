import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import ChatWorkspace from '@/workspaces/ChatWorkspace'
import { outputAreaVisibleAtom } from '@/atoms/outputTabsAtom'

describe('ChatWorkspace', () => {
  it('should NOT render right panel at all when output is closed', () => {
    const store = createStore()
    store.set(outputAreaVisibleAtom, false)
    const { container } = render(
      <Provider store={store}>
        <ChatWorkspace />
      </Provider>
    )
    // OutputArea returns null when outputVisible=false, but WorkspaceLayout.Right
    // still renders its container with border-l. The user sees empty space.
    // This test asserts the container itself should be absent.
    expect(container.querySelector('[aria-label="Hide panel"]')).toBeNull()
    expect(container.querySelector('[aria-label="Fullscreen"]')).toBeNull()
    // Key assertion: no border-l elements from right panel container
    const borderLeftElements = Array.from(container.querySelectorAll('[class*="border-l"]'))
    // Only the Left sidebar border or Main border should exist, not the right panel
    const rightPanelBorders = borderLeftElements.filter(el =>
      el.className && typeof el.className === 'string' && el.className.includes('border-l')
    )
    // With output closed, no right-side border-l should exist
    // WorkspaceLayout.Left uses border-r (right edge), not border-l
    // So any border-l means the Right slot is still present
    expect(rightPanelBorders.length).toBe(0)
  })

  it('should render right panel when output is open', () => {
    const store = createStore()
    store.set(outputAreaVisibleAtom, true)
    const { container } = render(
      <Provider store={store}>
        <ChatWorkspace />
      </Provider>
    )
    expect(container.querySelector('[aria-label="Hide panel"]')).toBeInTheDocument()
  })
})
