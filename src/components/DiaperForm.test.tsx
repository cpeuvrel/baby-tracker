import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAuth, mockHousehold } from '../test/mockContexts'
import type { DiaperEntry } from '../types/models'
import { DiaperForm } from './DiaperForm'

const logDiaper = vi.fn()
const updateDiaperEntry = vi.fn()
const deleteDiaperEntry = vi.fn()

vi.mock('../repositories/diaperEntries', () => ({
  logDiaper: (...args: unknown[]) => logDiaper(...args),
  updateDiaperEntry: (...args: unknown[]) => updateDiaperEntry(...args),
  deleteDiaperEntry: (...args: unknown[]) => deleteDiaperEntry(...args),
}))

const entry: DiaperEntry = {
  id: 'd1',
  type: 'wet',
  occurredAt: '2026-03-05T09:00:00.000Z',
  notes: 'existing note',
  createdBy: 'uid1',
  createdAt: '2026-03-05T09:00:00.000Z',
}

describe('DiaperForm', () => {
  beforeEach(() => {
    logDiaper.mockReset().mockResolvedValue(undefined)
    updateDiaperEntry.mockReset().mockResolvedValue(undefined)
    deleteDiaperEntry.mockReset().mockResolvedValue(undefined)
    mockAuth()
    mockHousehold({ babies: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs a diaper change with the selected type and notes, then calls onClose', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<DiaperForm onClose={onClose} />)
    await user.type(screen.getByLabelText('Notes (optional)'), 'a bit red')
    await user.click(screen.getByRole('button', { name: 'Dirty' }))

    expect(logDiaper).toHaveBeenCalledWith(
      'h1',
      'b1',
      'uid1',
      expect.objectContaining({ type: 'dirty', notes: 'a bit red' }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('logs a dry diaper check', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<DiaperForm onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Dry' }))

    expect(logDiaper).toHaveBeenCalledWith(
      'h1',
      'b1',
      'uid1',
      expect.objectContaining({ type: 'dry', notes: '' }),
    )
  })

  it('prefills the form from an existing entry and updates it on save', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<DiaperForm entry={entry} onClose={onClose} />)

    expect(screen.getByDisplayValue('existing note')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wet' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Dirty' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateDiaperEntry).toHaveBeenCalledWith(
      'h1',
      'b1',
      'd1',
      expect.objectContaining({ type: 'dirty', notes: 'existing note' }),
    )
    expect(onClose).toHaveBeenCalled()
    expect(logDiaper).not.toHaveBeenCalled()
  })

  it('deletes the entry after confirmation', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<DiaperForm entry={entry} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteDiaperEntry).toHaveBeenCalledWith('h1', 'b1', 'd1')
    expect(onClose).toHaveBeenCalled()
  })

  it('tells the user when the log is refused', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    logDiaper.mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()

    render(<DiaperForm onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Wet' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Could not save the diaper change. Please try again.'))
  })

  it('tells the user when the save is refused', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    updateDiaperEntry.mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()

    render(<DiaperForm entry={entry} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Could not save the diaper change. Please try again.'))
  })

  it('tells the user when the delete is refused', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteDiaperEntry.mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()

    render(<DiaperForm entry={entry} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Could not delete the diaper change. Please try again.'))
  })

  it('refuses to log without a date', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<DiaperForm onClose={onClose} />)

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Wet' }))

    expect(logDiaper).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a date.')
  })
})
