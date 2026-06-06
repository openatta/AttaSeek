import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  /** Optional hook for remote error reporting (e.g. crash analytics) */
  onError?: (error: Error, componentStack: string) => void
}

interface State {
  hasError: boolean
  error: Error | null
  recovered: boolean
}

const DRAFT_KEY = 'errorBoundary_draft'

interface CrashDraft {
  timestamp: number
  errorMessage: string
}

/**
 * ErrorBoundary — catches render errors in the component tree.
 * Saves a crash draft to sessionStorage before reload so the user can
 * recover context; supports an optional onError hook for remote reporting.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, recovered: false }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    console.error('[ErrorBoundary] caught render error:', error, info.componentStack)

    // Persist crash context so the next load can surface what happened
    try {
      const draft: CrashDraft = { timestamp: Date.now(), errorMessage: error.message }
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch { /* quota exceeded or disabled */ }

    // Optional remote reporting hook
    this.props.onError?.(error, info.componentStack)
  }

  componentDidMount(): void {
    // Check for a crash draft from a previous session
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw) as CrashDraft
        // Only surface if the crash happened in the last 5 minutes
        if (Date.now() - draft.timestamp < 300_000) {
          this.setState({ recovered: true })
        }
      }
    } catch { /* ignore corrupt draft */ }
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private handleDismiss = (): void => {
    try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
    this.setState({ recovered: false })
  }

  render() {
    if (this.state.recovered) {
      return (
        <>
          <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 text-black text-sm px-4 py-2 flex items-center justify-between">
            <span>
              The app was reloaded after an error: <code className="bg-black/10 px-1 rounded">{sessionStorage.getItem(DRAFT_KEY) ? (JSON.parse(sessionStorage.getItem(DRAFT_KEY)!) as CrashDraft).errorMessage : ''}</code>
            </span>
            <button onClick={this.handleDismiss} className="ml-4 underline">Dismiss</button>
          </div>
          {this.props.children}
        </>
      )
    }

    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 px-6 text-center">
          <h2 className="text-lg font-semibold text-[var(--app-text)]">Something went wrong</h2>
          <p className="text-sm text-[var(--app-text-secondary)] max-w-md">
            An unexpected error occurred. Reloading will attempt to restore your context.
          </p>
          <pre className="text-xs text-[var(--app-text-dim)] bg-[var(--app-bg-inset)] p-3 rounded-lg max-w-lg overflow-auto">
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button
            onClick={this.handleReload}
            className="px-4 py-2 rounded-lg bg-[var(--app-accent)] text-white text-sm hover:opacity-90 transition-opacity"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
