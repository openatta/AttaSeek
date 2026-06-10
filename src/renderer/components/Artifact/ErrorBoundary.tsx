/**
 * ErrorBoundary — catches rendering errors in the React tree
 * and displays a fallback UI instead of crashing the entire app.
 *
 * Each pane is wrapped individually so a crash in one pane
 * doesn't take down the AP panel or other panes.
 */

import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallbackLabel?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] pane crashed:', error.message, info.componentStack)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-sm text-[var(--app-text-tertiary)] max-w-md px-4">
            <div className="text-2xl mb-2">⚠️</div>
            <div className="font-medium text-[var(--app-text-secondary)] mb-1">
              {this.props.fallbackLabel || 'Something went wrong'}
            </div>
            <div className="text-xs opacity-50 mb-3 break-all">
              {this.state.error?.message || 'Unknown error'}
            </div>
            <button
              onClick={this.handleRetry}
              className="px-3 py-1 text-xs rounded bg-[var(--app-accent)]/10 text-[var(--app-accent)] hover:bg-[var(--app-accent)]/20 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
