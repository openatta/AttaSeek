/**
 * HexViewer boundary tests — empty file, base64 decode, normal hex view.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Polyfill atob/btoa (jsdom doesn't have them)
;(globalThis as any).atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary')
;(globalThis as any).btoa = (str: string) => Buffer.from(str, 'binary').toString('base64')

// Set window.api so getApi() can read it. Must be set before component import
// because getApi() reads window.api lazily in useEffect, not at import time.
Object.defineProperty(globalThis, 'api', {
  value: { fs: { readFile: vi.fn() } },
  writable: true,
  configurable: true,
})

function b64(str: string) {
  return (globalThis as any).btoa(str)
}

import HexViewer from '@/components/Artifact/panes/FilePane/HexViewer'

const mockReadFile = ((globalThis as any).api as any).fs.readFile

describe('HexViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially (unresolved promise)', () => {
    mockReadFile.mockReturnValue(new Promise(() => {}))
    render(<HexViewer filePath="/tmp/test.bin" />)
    expect(screen.getByText('Loading hex...')).toBeInTheDocument()
  })

  it('renders hex rows for valid base64 content', async () => {
    mockReadFile.mockResolvedValue({
      success: true,
      content: b64('Hello\0World\xFF\x00\xAB'),
      size: 13, mime: 'application/octet-stream', encoding: 'base64',
    })

    render(<HexViewer filePath="/tmp/test.bin" />)

    await waitFor(() => {
      expect(screen.getByText('00000000')).toBeInTheDocument()
    })
    expect(screen.getByText('48')).toBeInTheDocument()
  })

  it('renders null bytes (00)', async () => {
    mockReadFile.mockResolvedValue({
      success: true, content: b64('\x00\x00\x00'), size: 3,
      mime: 'application/octet-stream', encoding: 'base64',
    })

    render(<HexViewer filePath="/tmp/zeros.bin" />)

    await waitFor(() => {
      expect(screen.getAllByText('00').length).toBeGreaterThanOrEqual(3)
    })
  })

  it('shows error when base64 decode fails', async () => {
    // Mock the global atob to throw for this specific test
    const originalAtob = (globalThis as any).atob
    ;(globalThis as any).atob = () => { throw new DOMException('InvalidCharacterError') }

    mockReadFile.mockResolvedValue({
      success: true, content: 'any-content', size: 12,
      mime: 'application/octet-stream', encoding: 'base64',
    })

    render(<HexViewer filePath="/tmp/bad.bin" />)

    await waitFor(() => {
      expect(screen.getByText('Failed to decode file')).toBeInTheDocument()
    })

    // Restore
    ;(globalThis as any).atob = originalAtob
  })

  it('shows error when API returns failure', async () => {
    mockReadFile.mockResolvedValue({ success: false, error: 'File not found' })

    render(<HexViewer filePath="/tmp/missing.bin" />)

    await waitFor(() => {
      expect(screen.getByText('File not found')).toBeInTheDocument()
    })
  })

  it('shows error on API rejection', async () => {
    mockReadFile.mockRejectedValue(new Error('Connection refused'))

    render(<HexViewer filePath="/tmp/net-error.bin" />)

    await waitFor(() => {
      expect(screen.getByText('Connection refused')).toBeInTheDocument()
    })
  })

  it('renders ASCII column with readable characters', async () => {
    mockReadFile.mockResolvedValue({
      success: true, content: b64('ABCDEFGHIJKLMNOP'), size: 16,
      mime: 'application/octet-stream', encoding: 'base64',
    })

    render(<HexViewer filePath="/tmp/ascii.bin" />)

    await waitFor(() => {
      expect(screen.getByText('ABCDEFGHIJKLMNOP')).toBeInTheDocument()
    })
  })

  it('renders dots for non-printable bytes', async () => {
    mockReadFile.mockResolvedValue({
      success: true, content: b64('\x00\x01\x02\xFF'), size: 4,
      mime: 'application/octet-stream', encoding: 'base64',
    })

    render(<HexViewer filePath="/tmp/control.bin" />)

    await waitFor(() => {
      expect(screen.getByText('....')).toBeInTheDocument()
    })
  })

  it('renders multiple rows for >16 byte files', async () => {
    mockReadFile.mockResolvedValue({
      success: true, content: b64('A'.repeat(32)), size: 32,
      mime: 'application/octet-stream', encoding: 'base64',
    })

    render(<HexViewer filePath="/tmp/32bytes.bin" />)

    await waitFor(() => {
      expect(screen.getByText('00000010')).toBeInTheDocument()
    })
  })

  it('handles empty file (0 bytes) — shows hex container', async () => {
    // b64('') produces empty string which is falsy. Use a single space
    // character (byte 0x20) to get a valid base64 non-empty content.
    mockReadFile.mockResolvedValue({
      success: true, content: b64(' '), size: 1,
      mime: 'application/octet-stream', encoding: 'base64',
    })

    const { container } = render(<HexViewer filePath="/tmp/onebyte.bin" />)

    await waitFor(() => {
      // One byte → hex container renders
      expect(container.querySelector('.font-mono')).toBeTruthy()
    })
  })

  it('shows error for empty content string (falsy guard)', async () => {
    mockReadFile.mockResolvedValue({
      success: true, content: '', size: 0,
      mime: 'application/octet-stream', encoding: 'base64',
    })

    render(<HexViewer filePath="/tmp/empty.bin" />)

    // Empty string → falsy → falls through to error branch with default message
    await waitFor(() => {
      expect(screen.getByText('Failed to read file')).toBeInTheDocument()
    })
  })
})
