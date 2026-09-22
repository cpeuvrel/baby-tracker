import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
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
    logDiaper.mockReset()
    updateDiaperEntry.mockReset()
    deleteDiaperEntry.mockReset()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { uid: 'uid1' } as User,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household: { id: 'h1', name: 'Famille Test', memberUids: [] },
      babies: [],
      loading: false,
      selectedBaby: { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null },
      selectBaby: vi.fn(),
    })
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
})
