/**
 * Error boundary components for React
 * Catches and handles React component errors
 */

import { Component, ReactNode } from 'react'
import { errorLogger } from '../lib/errors'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  level?: 'page' | 'section' | 'component'
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorId: string
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorId: ''
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log the error
    errorLogger.error(`React Error in ${this.props.level || 'component'}`, error, {
      errorBoundary: true,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId
    })

    // Call optional error handler
    this.props.onError?.(error, errorInfo)
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorId: ''
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI based on level
      if (this.props.level === 'page') {
        return <PageErrorFallback errorId={this.state.errorId} onReset={this.resetError} />
      }

      if (this.props.level === 'section') {
        return (
          <div style={{
            padding: 'var(--space-4)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-subtle)',
            textAlign: 'center'
          }}>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
              Something went wrong in this section
            </p>
            <button
              onClick={this.resetError}
              style={{
                padding: 'var(--space-1) var(--space-2)',
                background: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)'
              }}
            >
              Try again
            </button>
          </div>
        )
      }

      // Minimal fallback for single components
      return null
    }

    return this.props.children
  }
}

/**
 * Page-level error fallback
 */
function PageErrorFallback({
  errorId,
  onReset
}: {
  errorId: string
  onReset: () => void
}) {
  return (
    <div className="app">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 'var(--space-8)',
        textAlign: 'center'
      }}>
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-tertiary)"
          strokeWidth="1.5"
          style={{ marginBottom: 'var(--space-4)' }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        
        <h1 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-2)'
        }}>
          Something went wrong
        </h1>
        
        <p style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-text-muted)',
          marginBottom: 'var(--space-4)',
          maxWidth: '400px'
        }}>
          We encountered an unexpected error. Your work has been saved automatically.
        </p>
        
        <div style={{
          display: 'flex',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <button
            onClick={onReset}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              fontWeight: 'var(--font-weight-medium)'
            }}
          >
            Try again
          </button>
          
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer'
            }}
          >
            Reload page
          </button>
        </div>
        
        <p style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-tertiary)',
          marginTop: 'var(--space-6)'
        }}>
          Error ID: {errorId}
        </p>
      </div>
    </div>
  )
}

/**
 * Async error wrapper for promise-based operations
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
): React.ComponentType<P> {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }
}

/**
 * Hook for manual error handling in components
 */
export function useErrorHandler() {
  return (error: Error) => {
    errorLogger.error('Caught error in hook', error)
    throw error
  }
}
