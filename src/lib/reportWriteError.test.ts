import { describe, expect, it, vi } from 'vitest'
import { reportWriteError } from './reportWriteError'

describe('reportWriteError', () => {
  it('logs the error and tells the user what could not be done', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('permission-denied')

    reportWriteError('save the entry')(error)

    expect(consoleError).toHaveBeenCalledWith(error)
    expect(alert).toHaveBeenCalledWith('Could not save the entry. Please try again.')
    alert.mockRestore()
    consoleError.mockRestore()
  })
})
