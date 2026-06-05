import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * ErrorBoundary — catches render errors in the component tree.
 * Prevents a single component crash from taking down the entire app.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    console.error('[ErrorBoundary] caught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 px-6 text-center">
          <h2 className="text-lg font-semibold text-[var(--app-text)]">Something went wrong</h2>
          <p className="text-sm text-[var(--app-text-secondary)] max-w-md">
            An unexpected error occurred. You can try reloading the window.
          </p>
          <pre className="text-xs text-[var(--app-text-dim)] bg-[var(--app-bg-inset)] p-3 rounded-lg max-w-lg overflow-auto">
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button
            onClick={() => window.location.reload()}
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
