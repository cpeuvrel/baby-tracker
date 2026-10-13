import { Component, type ErrorInfo, type ReactNode } from 'react'

interface AppErrorBoundaryProps {
  children: ReactNode
  /** The whole app failed: the fallback is a page of its own, with the app's title. */
  fullPage?: boolean
  /** A new value (e.g. the next route) gives the children another try. */
  resetKey?: unknown
}

interface AppErrorBoundaryState {
  failed: boolean
  resetKey: unknown
}

/**
 * Catches an exception thrown while rendering (corrupted data, bug) so the app shows a way
 * out instead of a blank page: a home-screen app has no address bar to reload from.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError(): Partial<AppErrorBoundaryState> {
    return { failed: true }
  }

  static getDerivedStateFromProps(
    props: AppErrorBoundaryProps,
    state: AppErrorBoundaryState,
  ): Partial<AppErrorBoundaryState> | null {
    return Object.is(props.resetKey, state.resetKey) ? null : { failed: false, resetKey: props.resetKey }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app] render failed', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children

    const fallback = (
      <>
        <p role="alert">Something went wrong.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </>
    )
    if (!this.props.fullPage) return fallback
    return (
      <main>
        <h1>Baby Tracker</h1>
        {fallback}
      </main>
    )
  }
}
