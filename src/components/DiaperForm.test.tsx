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
  notes: 'note existante',
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
      selectedBaby: { id: 'b1', name: 'Léo', birthDate: '2025-06-01' },
      selectBaby: vi.fn(),
    })
  })

  it('logs a diaper change with the selected type and notes, then calls onSaved', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(<DiaperForm onSaved={onSaved} />)
    await user.type(screen.getByLabelText('Notes (optionnel)'), 'un peu rouge')
    await user.click(screen.getByRole('button', { name: 'Dirty' }))

    expect(logDiaper).toHaveBeenCalledWith(
      'h1',
      'b1',
      'uid1',
      expect.objectContaining({ type: 'dirty', notes: 'un peu rouge' }),
    )
    expect(onSaved).toHaveBeenCalled()
  })

  it('logs a dry diaper check', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(<DiaperForm onSaved={onSaved} />)
    await user.click(screen.getByRole('button', { name: 'Dry' }))

    expect(logDiaper).toHaveBeenCalledWith(
      'h1',
      'b1',
      'uid1',
      expect.objectContaining({ type: 'dry', notes: '' }),
    )
  })

  it('prefills the form from an existing entry and updates it on save', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(<DiaperForm entry={entry} onSaved={onSaved} />)

    expect(screen.getByDisplayValue('note existante')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wet' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Dirty' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(updateDiaperEntry).toHaveBeenCalledWith(
      'h1',
      'b1',
      'd1',
      expect.objectContaining({ type: 'dirty', notes: 'note existante' }),
    )
    expect(onSaved).toHaveBeenCalled()
    expect(logDiaper).not.toHaveBeenCalled()
  })

  it('deletes the entry after confirmation', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<DiaperForm entry={entry} onSaved={onSaved} />)
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(deleteDiaperEntry).toHaveBeenCalledWith('h1', 'b1', 'd1')
    expect(onSaved).toHaveBeenCalled()
  })
})
