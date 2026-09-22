import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import { DiaperForm } from './DiaperForm'

const logDiaper = vi.fn()

vi.mock('../repositories/diaperEntries', () => ({
  logDiaper: (...args: unknown[]) => logDiaper(...args),
}))

describe('DiaperForm', () => {
  beforeEach(() => {
    logDiaper.mockReset()
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
    await user.click(screen.getByRole('button', { name: 'Caca' }))

    expect(logDiaper).toHaveBeenCalledWith('h1', 'b1', 'uid1', 'poop', 'un peu rouge')
    expect(onSaved).toHaveBeenCalled()
  })
})
