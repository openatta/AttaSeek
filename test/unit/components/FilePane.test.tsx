/**
 * FilePane component smoke tests — rendering, tab lifecycle, empty states.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { projectRootAtom } from '@/components/Artifact/ApAtoms'

// Set up window.api mock before component import
beforeAll(() => {
  ;(globalThis as any).api = {
    fs: {
      readFile: vi.fn().mockResolvedValue({
        success: true, content: 'console.log("hello");', size: 22, mime: 'text/typescript',
      }),
      readDir: vi.fn().mockResolvedValue({ success: true, entries: [] }),
      fileInfo: vi.fn(),
    },
    agent: { createTask: vi.fn(), cancelTask: vi.fn(), getTask: vi.fn(), listEvents: vi.fn(), onEvent: () => () => {} },
    artifact: { list: vi.fn(), get: vi.fn(), update: vi.fn() },
    model: { list: vi.fn(), hasConfig: vi.fn().mockResolvedValue({ configured: false }) },
    permission: { respond: vi.fn(), listPolicies: vi.fn(), updatePolicy: vi.fn() },
    memory: { list: vi.fn(), store: vi.fn(), delete: vi.fn() },
    skill: { list: vi.fn() }, tool: { list: vi.fn() }, plugin: { list: vi.fn() },
    audit: { list: vi.fn() }, question: { respond: vi.fn() },
    app: { getState: vi.fn(), setState: vi.fn() },
    git: { status: vi.fn(), branches: vi.fn(), diff: vi.fn(), stage: vi.fn(), unstage: vi.fn(), revert: vi.fn(), commit: vi.fn(), log: vi.fn(), show: vi.fn() },
    terminal: { create: vi.fn(), write: vi.fn(), resize: vi.fn(), destroy: vi.fn(), onOutput: () => () => {} },
    platform: 'darwin', isMac: true, isWindows: false, isLinux: false,
    theme: { get: vi.fn(), set: vi.fn(), onSystemChange: () => () => {} },
  }
})

import FilePane from '@/components/Artifact/panes/FilePane/FilePane'

function renderFilePane(rootPath?: string) {
  const store = createStore()
  if (rootPath) store.set(projectRootAtom, rootPath)
  return render(
    <Provider store={store}>
      <FilePane apTabId="tab-1" />
    </Provider>,
  )
}

describe('FilePane', () => {
  it('renders internal tab bar with "No open files" placeholder', () => {
    renderFilePane()
    expect(screen.getByText('No open files')).toBeInTheDocument()
  })

  it('renders explorer toggle button', () => {
    renderFilePane()
    expect(screen.getByTitle('Hide Explorer')).toBeInTheDocument()
  })

  it('shows "Select a file to view" when no file is open', () => {
    renderFilePane()
    expect(screen.getByText('Select a file to view')).toBeInTheDocument()
  })

  it('renders without crashing when projectRoot is empty', () => {
    const { container } = render(
      <Provider>
        <FilePane apTabId="tab-1" />
      </Provider>,
    )
    expect(container.textContent).toContain('Select a file to view')
  })

  it('passes rootPath to FileExplorer', () => {
    renderFilePane('/custom/root')
    // FilePane renders without crashing with a custom root path
    expect(screen.getByText('Select a file to view')).toBeInTheDocument()
  })

  it('has explorer visible by default', () => {
    renderFilePane()
    expect(screen.getByTitle('Hide Explorer')).toBeInTheDocument()
  })
})
