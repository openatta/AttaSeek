import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SessionHeader from '@/components/Conversation/SessionHeader'

describe('SessionHeader', () => {
  it('should display "New Session" as the default title', () => {
    render(<SessionHeader />)
    expect(screen.getByText('New Session')).toBeInTheDocument()
  })

  it('should display a context usage percentage', () => {
    render(<SessionHeader />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('should render three action buttons', () => {
    render(<SessionHeader />)
    expect(screen.getByLabelText('应用面板')).toBeInTheDocument()
    expect(screen.getByLabelText('环境信息')).toBeInTheDocument()
    expect(screen.getByLabelText('AI 输出区域')).toBeInTheDocument()
  })

  it('should have bottom border at 40px height', () => {
    const { container } = render(<SessionHeader />)
    const header = container.firstChild as HTMLElement
    expect(header.className).toContain('h-[40px]')
    expect(header.className).toContain('border-b')
  })
})
