/**
 * ProjectCreateDialog unit tests — form validation, button states, error display.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'jotai'

// Must set window.api BEFORE the dialog module is imported.
// ProjectCreateDialog calls getApi().project.create() on submit.
beforeAll(() => {
  ;(globalThis as any).api = {
    project: {
      create: vi.fn().mockResolvedValue({ success: true, project: { id: 'new', name: 'Test', rootPath: '/tmp/test', createdAt: 1 } }),
    },
  }
})

import ProjectCreateDialog from '@/components/Project/ProjectCreateDialog'

function renderDialog(open = true) {
  const onClose = vi.fn()
  const onCreated = vi.fn()
  return {
    onClose,
    onCreated,
    ...render(
      <Provider>
        <ProjectCreateDialog open={open} onClose={onClose} onCreated={onCreated} />
      </Provider>,
    ),
  }
}

describe('ProjectCreateDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = renderDialog(false)
    expect(container.innerHTML).toBe('')
  })

  it('shows heading and inputs when open', () => {
    renderDialog()
    expect(screen.getByRole('heading', { name: '创建项目' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('MyApp')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('/Users/xbits/MyApp')).toBeInTheDocument()
  })

  it('create button is disabled when name is empty', () => {
    renderDialog()
    const btn = screen.getByRole('button', { name: /创建项目/ })
    expect(btn).toBeDisabled()
  })

  it('create button is disabled when path is empty', async () => {
    renderDialog()
    fireEvent.change(screen.getByPlaceholderText('MyApp'), { target: { value: 'MyApp' } })
    // Path still empty — button should be disabled
    const btn = screen.getByRole('button', { name: /创建项目/ })
    await waitFor(() => expect(btn).toBeDisabled())
  })

  it('create button is enabled when both fields are filled', async () => {
    renderDialog()
    fireEvent.change(screen.getByPlaceholderText('MyApp'), { target: { value: 'MyApp' } })
    fireEvent.change(screen.getByPlaceholderText('/Users/xbits/MyApp'), { target: { value: '/tmp/test' } })
    const btn = screen.getByRole('button', { name: /创建项目/ })
    await waitFor(() => expect(btn).not.toBeDisabled())
  })

  it('cancel button calls onClose', () => {
    const { onClose } = renderDialog()
    fireEvent.click(screen.getByText('取消'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('submit calls API and triggers onCreated + onClose', async () => {
    const { onCreated, onClose } = renderDialog()
    fireEvent.change(screen.getByPlaceholderText('MyApp'), { target: { value: 'NewProject' } })
    fireEvent.change(screen.getByPlaceholderText('/Users/xbits/MyApp'), { target: { value: '/tmp/new' } })
    fireEvent.click(screen.getByRole('button', { name: /创建项目/ }))

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('shows error message when API fails', async () => {
    const mockCreate = (globalThis as any).api.project.create
    mockCreate.mockResolvedValueOnce({ success: false, error: '目录已被项目 "Existing" 使用' })

    renderDialog()
    fireEvent.change(screen.getByPlaceholderText('MyApp'), { target: { value: 'DupProject' } })
    fireEvent.change(screen.getByPlaceholderText('/Users/xbits/MyApp'), { target: { value: '/tmp/existing' } })
    fireEvent.click(screen.getByRole('button', { name: /创建项目/ }))

    await waitFor(() => {
      expect(screen.getByText('目录已被项目 "Existing" 使用')).toBeInTheDocument()
    })
  })

  it('backdrop click calls onClose', () => {
    const { onClose } = renderDialog()
    // The backdrop is the first fixed overlay
    const backdrop = document.querySelector('.fixed.inset-0.z-50.bg-black\\/30')
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    }
  })
})
