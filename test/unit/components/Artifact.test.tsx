import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Artifact from '@/components/Artifact/Artifact'

describe('Artifact', () => {
  it('should display a placeholder when no files are open', () => {
    render(<Artifact />)
    expect(screen.getByText('No files open')).toBeInTheDocument()
  })

  it('should display an empty-state message', () => {
    render(<Artifact />)
    expect(
      screen.getByText(/Artifacts appear here/)
    ).toBeInTheDocument()
  })

  it('should render expand and hide buttons', () => {
    render(<Artifact />)
    expect(screen.getByTitle('Expand panel')).toBeInTheDocument()
    expect(screen.getByTitle('Hide panel')).toBeInTheDocument()
  })
})
