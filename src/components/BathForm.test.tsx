import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAuth, mockHousehold } from '../test/mockContexts'
import type { BathEntry } from '../types/models'
import { dateTimeValue, setDateTime } from '../test/timeFields'
import { BathForm } from './BathForm'

const logBath = vi.fn()
const updateBathEntry = vi.fn()
const deleteBathEntry = vi.fn()

vi.mock('../repositories/bathEntries', () => ({
  logBath: (...args: unknown[]) => logBath(...args),
  updateBathEntry: (...args: unknown[]) => updateBathEntry(...args),
  deleteBathEntry: (...args: unknown[]) => deleteBathEntry(...args),
}))

const entry: BathEntry = {
  id: 'd1',
  occurredAt: '2026-03-05T09:00:00.000Z',
  notes: 'existing note',
  createdBy: 'uid1',
  createdAt: '2026-03-05T09:00:00.000Z',
}

describe('BathForm', () => {
  beforeEach(() => {
    logBath.mockReset().mockResolvedValue(undefined)
    updateBathEntry.mockReset().mockResolvedValue(undefined)
    deleteBathEntry.mockReset().mockResolvedValue(undefined)
    mockAuth()
    mockHousehold({ babies: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs a new bath at the picked time with notes', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<BathForm onClose={onClose} />)

    setDateTime('Time', '2026-03-05T19:30')
    await user.type(screen.getByLabelText('Notes (optional)'), 'with toys')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(logBath).toHaveBeenCalledWith('h1', 'b1', 'uid1', {
      occurredAt: new Date('2026-03-05T19:30:00+01:00'),
      notes: 'with toys',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('edits and deletes an existing bath', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    const { unmount } = render(<BathForm entry={entry} onClose={vi.fn()} />)

    expect(dateTimeValue('Time')).toBe('2026-03-05T10:00')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(updateBathEntry).toHaveBeenCalledWith('h1', 'b1', 'd1', {
      occurredAt: new Date(entry.occurredAt),
      notes: 'existing note',
    })
    unmount()

    render(<BathForm entry={entry} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(deleteBathEntry).toHaveBeenCalledWith('h1', 'b1', 'd1')
  })

  it('tells the user when the save is refused', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    logBath.mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()

    render(<BathForm onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Could not save the bath. Please try again.'))
  })

  it('tells the user when the delete is refused', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteBathEntry.mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()

    render(<BathForm entry={entry} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Could not delete the bath. Please try again.'))
  })

  it('refuses to save without a date', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<BathForm onClose={onClose} />)

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(logBath).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a date.')
  })
})
