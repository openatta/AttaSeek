/**
 * BrowserNavBar — navigation bar for the Browser Pane.
 * Layout: [←] [→] [↻] | URL input | [⋮ menu]
 *
 * Uses <form onSubmit> for Enter handling — the most reliable cross-browser
 * approach. onKeyDown with e.key === 'Enter' can fail with IME, keyboard
 * layouts, or Electron-specific event quirks.
 */

import { type ReactNode, useState, useRef } from 'react'
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react'

interface BrowserNavBarProps {
  url: string
  canGoBack: boolean
  canGoForward: boolean
  onUrlChange: (url: string) => void
  onNavigate: (url: string) => void
  onBack: () => void
  onForward: () => void
  onRefresh: () => void
  menu: ReactNode
}

export default function BrowserNavBar({
  url, canGoBack, canGoForward,
  onUrlChange, onNavigate, onBack, onForward, onRefresh, menu,
}: BrowserNavBarProps) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = (inputRef.current?.value || url).trim()
    if (value) {
      onNavigate(value)
    }
  }

  return (
    <div className="flex items-center h-[32px] px-2 gap-1 border-b border-[var(--app-border)] flex-shrink-0 bg-[var(--app-bg-secondary)]">
      <button
        onClick={onBack} disabled={!canGoBack}
        className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] disabled:opacity-30 disabled:cursor-default transition-colors"
        title="Back"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onForward} disabled={!canGoForward}
        className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] disabled:opacity-30 disabled:cursor-default transition-colors"
        title="Forward"
      >
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onRefresh}
        className="w-6 h-6 flex items-center justify-center rounded text-[var(--app-text-tertiary)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] transition-colors"
        title="Refresh"
      >
        <RefreshCw className="w-3 h-3" />
      </button>

      <form onSubmit={handleSubmit} className="flex-1 mx-2">
        <input
          ref={inputRef}
          type="text"
          defaultValue={url}
          key={url} // re-create when URL changes externally (e.g. webview navigation)
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            // Sync the external URL back to the input
            if (inputRef.current) inputRef.current.value = url
          }}
          className="w-full h-[24px] px-2 text-xs bg-[var(--app-bg-primary)] border border-[var(--app-border)] rounded text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]"
          placeholder="Search or enter URL..."
        />
      </form>

      {menu}
    </div>
  )
}
