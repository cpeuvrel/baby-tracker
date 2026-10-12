import { afterEach, describe, expect, it, vi } from 'vitest'
import { alertSleepWriteFailed } from './sleepAlreadyRunning'

describe('alertSleepWriteFailed', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('names the running sleep when a write taking the lock is refused', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})

    alertSleepWriteFailed({ code: 'permission-denied' }, true)

    expect(alert).toHaveBeenCalledWith('Another sleep timer is already running.')
  })

  it('gives the generic message for a refused write that does not take the lock', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    alertSleepWriteFailed({ code: 'permission-denied' }, false)

    expect(alert).toHaveBeenCalledWith('Could not save this sleep. Please try again.')
  })

  it('gives the generic message for any other failure, and logs it', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('network')

    alertSleepWriteFailed(error, true)

    expect(alert).toHaveBeenCalledWith('Could not save this sleep. Please try again.')
    expect(consoleError).toHaveBeenCalledWith(error)
  })
})
