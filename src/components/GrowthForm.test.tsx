import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import type { GrowthEntry } from '../types/models'
import { GrowthForm } from './GrowthForm'

const addGrowthEntry = vi.fn()
const updateGrowthEntry = vi.fn()
const deleteGrowthEntry = vi.fn()

vi.mock('../repositories/growthEntries', () => ({
  addGrowthEntry: (...args: unknown[]) => addGrowthEntry(...args),
  updateGrowthEntry: (...args: unknown[]) => updateGrowthEntry(...args),
  deleteGrowthEntry: (...args: unknown[]) => deleteGrowthEntry(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: [] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

const entry: GrowthEntry = {
  id: 'g1',
  measuredAt: '2026-03-05T10:00:00.000Z',
  weightG: 6200,
  heightMm: 620,
  headCircumferenceMm: null,
  notes: 'fasting',
  createdBy: 'uid1',
  createdAt: '2026-03-05T10:00:00.000Z',
}

describe('GrowthForm', () => {
  beforeEach(() => {
    addGrowthEntry.mockReset()
    updateGrowthEntry.mockReset()
    deleteGrowthEntry.mockReset()
    localStorage.clear()
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
      household,
      babies: [baby],
      loading: false,
      error: null,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })
  })

  it('submits a growth measurement converted to grams and millimeters, then calls onClose', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<GrowthForm onClose={onClose} />)
    await user.type(screen.getByLabelText('Weight (kg)'), '6.2')
    await user.type(screen.getByLabelText('Height (cm)'), '62')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(addGrowthEntry).toHaveBeenCalledWith(
      'h1',
      'b1',
      'uid1',
      expect.objectContaining({ weightG: 6200, heightMm: 620, headCircumferenceMm: null }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('converts from pounds and inches when the imperial unit is preferred', async () => {
    localStorage.setItem('baby-tracker:unitSystem', 'imperial')
    const user = userEvent.setup()

    render(<GrowthForm onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Weight (lb)'), '10')
    await user.type(screen.getByLabelText('Height (in)'), '20')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(addGrowthEntry).toHaveBeenCalledWith(
      'h1',
      'b1',
      'uid1',
      expect.objectContaining({ weightG: 4536, heightMm: 508 }),
    )
  })

  it('prefills the form from an existing entry, converted back to display units, and updates it', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<GrowthForm entry={entry} onClose={onClose} />)

    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(6.2)
    expect(screen.getByLabelText('Height (cm)')).toHaveValue(62)
    expect(screen.getByDisplayValue('fasting')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateGrowthEntry).toHaveBeenCalledWith(
      'h1',
      'b1',
      'g1',
      expect.objectContaining({ weightG: 6200, heightMm: 620, notes: 'fasting' }),
    )
    expect(onClose).toHaveBeenCalled()
    expect(addGrowthEntry).not.toHaveBeenCalled()
  })

  it('deletes the entry after confirmation', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<GrowthForm entry={entry} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteGrowthEntry).toHaveBeenCalledWith('h1', 'b1', 'g1')
    expect(onClose).toHaveBeenCalled()
  })
})
