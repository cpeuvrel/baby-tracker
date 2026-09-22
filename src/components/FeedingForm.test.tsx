import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
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

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01' }

const entry: FeedingEntry = {
  id: 'f1',
  type: 'bottle',
  occurredAt: '2026-03-05T09:00:00.000Z',
  volumeMl: 120,
  foodType: null,
  notes: 'note existante',
  createdBy: 'uid1',
  createdAt: '2026-03-05T09:00:00.000Z',
}

function renderFeedingForm(onSaved = vi.fn(), feedingEntry?: FeedingEntry) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user: { uid: 'uid1' } as User,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  })
  vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
    household,
    babies: [baby],
    loading: false,
    selectedBaby: baby,
    selectBaby: vi.fn(),
  })
  render(<FeedingForm entry={feedingEntry} onSaved={onSaved} />)
}

describe('FeedingForm', () => {
  beforeEach(() => {
    logFeeding.mockReset()
    updateFeedingEntry.mockReset()
    deleteFeedingEntry.mockReset()
  })

  it('logs a bottle feeding with the entered volume, defaulting the time to now, then calls onSaved', async () => {
    const before = Date.now()
    const onSaved = vi.fn()
    const user = userEvent.setup()

    renderFeedingForm(onSaved)
    await user.type(screen.getByLabelText('Volume (mL, optionnel)'), '120')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(logFeeding).toHaveBeenCalledTimes(1)
    const [, , , input] = logFeeding.mock.calls[0]
    expect(input).toMatchObject({ type: 'bottle', volumeMl: 120, foodType: null, notes: '' })
    expect(input.occurredAt).toBeInstanceOf(Date)
    expect(input.occurredAt.getTime()).toBeGreaterThanOrEqual(before - 60_000)
    expect(input.occurredAt.getTime()).toBeLessThanOrEqual(Date.now() + 60_000)
    expect(onSaved).toHaveBeenCalled()
  })

  it('logs a solid feeding with the entered food type', async () => {
    const user = userEvent.setup()

    renderFeedingForm()
    await user.click(screen.getByRole('button', { name: 'Solide' }))
    await user.type(screen.getByLabelText('Aliment (optionnel)'), 'purée carotte')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(logFeeding).toHaveBeenCalledTimes(1)
    const [, , , input] = logFeeding.mock.calls[0]
    expect(input).toMatchObject({
      type: 'solid',
      volumeMl: null,
      foodType: 'purée carotte',
      notes: '',
    })
  })

  it('prefills the form from an existing entry and updates it on save', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()

    renderFeedingForm(onSaved, entry)

    expect(screen.getByLabelText('Volume (mL, optionnel)')).toHaveValue(120)
    expect(screen.getByDisplayValue('note existante')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(updateFeedingEntry).toHaveBeenCalledWith(
      'h1',
      'b1',
      'f1',
      expect.objectContaining({ type: 'bottle', volumeMl: 120, notes: 'note existante' }),
    )
    expect(onSaved).toHaveBeenCalled()
    expect(logFeeding).not.toHaveBeenCalled()
  })

  it('deletes the entry after confirmation', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderFeedingForm(onSaved, entry)
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(deleteFeedingEntry).toHaveBeenCalledWith('h1', 'b1', 'f1')
    expect(onSaved).toHaveBeenCalled()
  })
})
