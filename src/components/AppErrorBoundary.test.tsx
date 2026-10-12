import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from './AppErrorBoundary'

function Thrower({ fail }: { fail: boolean }) {
  if (fail) throw new Error('boom')
  return <p>Screen</p>
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    // React and the boundary both report the caught error.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders its children while they render fine', () => {
    render(
      <AppErrorBoundary>
        <Thrower fail={false} />
      </AppErrorBoundary>,
    )

    expect(screen.getByText('Screen')).toBeInTheDocument()
  })

  it('replaces a failing screen with a message and a Reload button', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    const user = userEvent.setup()
    render(
      <AppErrorBoundary fullPage>
        <Thrower fail />
      </AppErrorBoundary>,
    )

    expect(screen.getByRole('heading', { name: 'Baby Tracker' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.')
    await user.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith('[app] render failed', expect.any(Error), expect.anything())
  })

  it('gives the children another try when the reset key changes', () => {
    const { rerender } = render(
      <AppErrorBoundary resetKey="/history">
        <Thrower fail />
      </AppErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(
      <AppErrorBoundary resetKey="/history">
        <Thrower fail={false} />
      </AppErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(
      <AppErrorBoundary resetKey="/trends">
        <Thrower fail={false} />
      </AppErrorBoundary>,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Screen')).toBeInTheDocument()
  })
})
