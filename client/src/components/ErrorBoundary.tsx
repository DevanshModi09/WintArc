import { Component, type ErrorInfo, type ReactNode } from 'react'

// Catches a crash while rendering, so a bug shows a way out instead of a
// blank page.
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="mx-auto max-w-sm space-y-4 px-6 py-24">
        <h1 className="text-[32px] leading-[1.1] font-bold">Something broke</h1>
        <p className="text-muted">Your progress is safe. Reloading usually sorts it out.</p>
        <button className="btn w-full" onClick={() => window.location.reload()}>
          Reload
        </button>
      </main>
    )
  }
}
