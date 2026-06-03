import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AppLauncher from '@/components/Conversation/AppLauncher'

describe('AppLauncher', () => {
  it('should show a chevron/dropdown indicator on the launch button', () => {
    render(<AppLauncher />)
    // The button should contain both the Monitor icon and a chevron indicator
    const btn = screen.getByLabelText('Launch app')
    // Check that the button renders a dropdown arrow (ChevronDown icon)
    expect(btn.querySelector('svg.lucide-chevron-down')).toBeInTheDocument()
  })
})
