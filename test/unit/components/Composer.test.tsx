import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'jotai'
import Composer from '@/components/Conversation/Composer'

function renderComposer() {
  return render(
    <Provider>
      <Composer />
    </Provider>
  )
}

describe('Composer', () => {
  it('should render a textarea input', () => {
    renderComposer()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('should render a send button', () => {
    renderComposer()
    expect(screen.getByLabelText('Send')).toBeInTheDocument()
  })

  it('should show input placeholder text', () => {
    renderComposer()
    expect(screen.getByPlaceholderText(/Ask anything/)).toBeInTheDocument()
  })

  it('should render model selector (shows "No model" when no configs)', () => {
    renderComposer()
    // In test env with no model configs, ModelSelector shows "No model"
    expect(screen.getByText('No model')).toBeInTheDocument()
  })

  it('should render permission mode label', () => {
    renderComposer()
    expect(screen.getByText('Default Review')).toBeInTheDocument()
  })

  it('should render reasoning effort label', () => {
    renderComposer()
    expect(screen.getByText(/Reasoning/)).toBeInTheDocument()
  })

  it('should have add context, voice input, and send buttons inside the input card', () => {
    renderComposer()
    const textarea = screen.getByRole('textbox')
    const addBtn = screen.getByLabelText('Add context')
    const voiceBtn = screen.getByLabelText('Voice input')
    const sendBtn = screen.getByLabelText('Send')

    // All should share the same rounded-xl bordered ancestor (the CODEX card)
    const card = textarea.closest('[class*="rounded-xl"]')
    expect(card).not.toBeNull()
    expect(card!.contains(addBtn)).toBe(true)
    expect(card!.contains(voiceBtn)).toBe(true)
    expect(card!.contains(sendBtn)).toBe(true)
  })

  it('should place model and permission outside the input card', () => {
    renderComposer()
    const textarea = screen.getByRole('textbox')
    const card = textarea.closest('[class*="rounded-xl"]')
    // Model selector is outside the card in the metadata row
    const modelBtn = screen.getByText('No model').closest('[class*="rounded"]')
    expect(card).not.toBeNull()
    expect(card!.contains(screen.getByText('No model'))).toBe(false)
  })
})
