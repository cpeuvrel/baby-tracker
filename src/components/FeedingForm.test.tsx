import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockAuth, mockHousehold } from '../test/mockContexts'
import type { FeedingEntry } from '../types/models'
import { FeedingForm } from './FeedingForm'

const logFeeding = vi.fn()
const updateFeedingEntry = vi.fn()
const deleteFeedingEntry = vi.fn()

vi.mock('../repositories/feedingEntries', () => ({
  logFeeding: (...args: unknown[]) => logFeeding(...args),
  updateFeedingEntry: (...args: unknown[]) => updateFeedingEntry(...args),
  deleteFeedingEntry: (...args: unknown[]) => deleteFeedingEntry(...args),
}))

const entry: FeedingEntry = {
  id: 'f1',
  type: 'bottle',
  occurredAt: '2026-03-05T09:00:00.000Z',
  volumeMl: 120,
  foodType: null,
  notes: 'existing note',
  createdBy: 'uid1',
  createdAt: '2026-03-05T09:00:00.000Z',
}

function renderFeedingForm(onClose = vi.fn(), feedingEntry?: FeedingEntry) {
  mockAuth()
  mockHousehold()
  render(<FeedingForm entry={feedingEntry} onClose={onClose} />)
}

describe('FeedingForm', () => {
  beforeEach(() => {
    logFeeding.mockReset().mockResolvedValue(undefined)
    updateFeedingEntry.mockReset().mockResolvedValue(undefined)
    deleteFeedingEntry.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs a bottle feeding with the entered volume, defaulting the time to now, then calls onClose', async () => {
    const before = Date.now()
    const onClose = vi.fn()
    const user = userEvent.setup()

    renderFeedingForm(onClose)
    await user.type(screen.getByLabelText('Volume (mL, optional)'), '120')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(logFeeding).toHaveBeenCalledTimes(1)
    const [, , , input] = logFeeding.mock.calls[0]
    expect(input).toMatchObject({ type: 'bottle', volumeMl: 120, foodType: null, notes: '' })
    expect(input.occurredAt).toBeInstanceOf(Date)
    expect(input.occurredAt.getTime()).toBeGreaterThanOrEqual(before - 60_000)
    expect(input.occurredAt.getTime()).toBeLessThanOrEqual(Date.now() + 60_000)
    expect(onClose).toHaveBeenCalled()
  })

  it('logs a solid feeding with the entered food type', async () => {
    const user = userEvent.setup()

    renderFeedingForm()
    await user.click(screen.getByRole('button', { name: 'Solid' }))
    await user.type(screen.getByLabelText('Food (optional)'), 'carrot purée')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(logFeeding).toHaveBeenCalledTimes(1)
    const [, , , input] = logFeeding.mock.calls[0]
    expect(input).toMatchObject({
      type: 'solid',
      volumeMl: null,
      foodType: 'carrot purée',
      notes: '',
    })
  })

  it('prefills the form from an existing entry and updates it on save', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    renderFeedingForm(onClose, entry)

    expect(screen.getByLabelText('Volume (mL, optional)')).toHaveValue(120)
    expect(screen.getByDisplayValue('existing note')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateFeedingEntry).toHaveBeenCalledWith(
      'h1',
      'b1',
      'f1',
      expect.objectContaining({ type: 'bottle', volumeMl: 120, notes: 'existing note' }),
    )
    expect(onClose).toHaveBeenCalled()
    expect(logFeeding).not.toHaveBeenCalled()
  })

  it('deletes the entry after confirmation', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderFeedingForm(onClose, entry)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteFeedingEntry).toHaveBeenCalledWith('h1', 'b1', 'f1')
    expect(onClose).toHaveBeenCalled()
  })

  it.each(['-5', '0'])('refuses a volume of %s with a message under the field', async (volume) => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    renderFeedingForm(onClose)
    await user.type(screen.getByLabelText('Volume (mL, optional)'), volume)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(logFeeding).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a volume above 0')
  })

  it('refuses to save without a date', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    renderFeedingForm(onClose)
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(logFeeding).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a date.')
  })

  it('tells the user when the save is refused', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    logFeeding.mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()

    renderFeedingForm()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Could not save the feeding. Please try again.'))
  })

  it('tells the user when the delete is refused', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteFeedingEntry.mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()

    renderFeedingForm(vi.fn(), entry)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith('Could not delete the feeding. Please try again.'))
  })
})
