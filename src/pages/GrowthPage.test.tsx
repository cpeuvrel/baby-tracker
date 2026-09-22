import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import * as useGrowthEntriesModule from '../hooks/useGrowthEntries'
import type { GrowthEntry } from '../types/models'
import { GrowthPage } from './GrowthPage'

const addGrowthEntry = vi.fn()

vi.mock('../repositories/growthEntries', () => ({
  addGrowthEntry: (...args: unknown[]) => addGrowthEntry(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01' }

describe('GrowthPage', () => {
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

  it('submits a growth measurement converted to grams and millimeters', async () => {
    vi.spyOn(useGrowthEntriesModule, 'useGrowthEntries').mockReturnValue([])
    const user = userEvent.setup()

    render(<GrowthPage />)
    await user.type(screen.getByLabelText('Poids (kg)'), '6.2')
    await user.type(screen.getByLabelText('Taille (cm)'), '62')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(addGrowthEntry).toHaveBeenCalledWith('h1', 'b1', 'uid1', {
      weightG: 6200,
      heightMm: 620,
      headCircumferenceMm: null,
    })
  })

  it('shows a placeholder when no measurement exists for the selected metric', () => {
    vi.spyOn(useGrowthEntriesModule, 'useGrowthEntries').mockReturnValue([])

    render(<GrowthPage />)

    expect(screen.getByText('Aucune mesure enregistrée pour poids.')).toBeInTheDocument()
  })

  it('switches the displayed metric', async () => {
    const entries: GrowthEntry[] = [
      {
        id: 'g1',
        measuredAt: '2026-02-01T10:00:00.000Z',
        weightG: 5800,
        heightMm: 580,
        headCircumferenceMm: null,
        notes: '',
        createdBy: 'uid1',
        createdAt: '2026-02-01T10:00:00.000Z',
      },
    ]
    vi.spyOn(useGrowthEntriesModule, 'useGrowthEntries').mockReturnValue(entries)
    const user = userEvent.setup()

    render(<GrowthPage />)
    expect(screen.queryByText(/Aucune mesure/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Périmètre crânien' }))

    expect(screen.getByText('Aucune mesure enregistrée pour périmètre crânien.')).toBeInTheDocument()
  })
})
