/**
 * ProjectsSidebar smoke tests — verifies the component renders without
 * crashing. Full UI interaction coverage is in E2E (Playwright) tests
 * which use a complete mock API via window.api injection.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'jotai'

// Set up window.api BEFORE the component module is imported.
// The component calls getApi() in useEffect which reads from window.api.
// Must provide a full API shape so api.project / api.session exist.
beforeAll(() => {
  const noop = () => Promise.resolve({})
  ;(globalThis as any).api = {
    project: { create: noop, list: () => Promise.resolve({ success: true, projects: [] }), remove: noop, validate: noop },
    session: { create: noop, list: () => Promise.resolve({ success: true, sessions: [] }) },
  }
})

import ProjectsSidebar from '@/workspaces/ProjectsSidebar'

describe('ProjectsSidebar', () => {
  it('renders PROJECTS heading without crashing', () => {
    const { container } = render(
      <Provider>
        <ProjectsSidebar selectedSessionId={null} onSelectSession={vi.fn()} />
      </Provider>,
    )
    expect(container.textContent).toContain('PROJECTS')
  })

  it('shows New Project button', () => {
    render(
      <Provider>
        <ProjectsSidebar selectedSessionId={null} onSelectSession={vi.fn()} />
      </Provider>,
    )
    expect(screen.queryByLabelText('New Project')).toBeTruthy()
  })
})
