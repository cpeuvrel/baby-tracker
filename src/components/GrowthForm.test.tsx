import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import { GrowthForm } from './GrowthForm'

const addGrowthEntry = vi.fn()

vi.mock('../repositories/growthEntries', () => ({
  addGrowthEntry: (...args: unknown[]) => addGrowthEntry(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01' }

describe('GrowthForm', () => {
  beforeEach(() => {
    addGrowthEntry.mockReset()
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
  })

  it('submits a growth measurement converted to grams and millimeters, then calls onSaved', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(<GrowthForm onSaved={onSaved} />)
    await user.type(screen.getByLabelText('Poids (kg)'), '6.2')
    await user.type(screen.getByLabelText('Taille (cm)'), '62')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(addGrowthEntry).toHaveBeenCalledWith('h1', 'b1', 'uid1', {
      weightG: 6200,
      heightMm: 620,
      headCircumferenceMm: null,
    })
    expect(onSaved).toHaveBeenCalled()
  })
})
