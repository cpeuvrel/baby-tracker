import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
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
    logBath.mockReset()
    updateBathEntry.mockReset()
    deleteBathEntry.mockReset()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { uid: 'uid1' } as User,
      loading: false,
      error: null,
      devLoginAvailable: false,
      loginWithGoogle: vi.fn(),
      loginWithPassword: vi.fn(),
      logout: vi.fn(),
    })
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household: { id: 'h1', name: 'Famille Test', memberUids: [] },
      babies: [],
      loading: false,
      error: null,
      selectedBaby: { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null },
      selectBaby: vi.fn(),
    })
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
})
