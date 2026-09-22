import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as HouseholdContext from '../contexts/HouseholdContext'
import { FamilyPage } from './FamilyPage'

const addBaby = vi.fn()
const updateBaby = vi.fn()

vi.mock('../repositories/babies', () => ({
  addBaby: (...args: unknown[]) => addBaby(...args),
  updateBaby: (...args: unknown[]) => updateBaby(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: ['uid1', 'uid2'] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01' }

describe('FamilyPage', () => {
  beforeEach(() => {
    addBaby.mockReset()
  })

  it('renders nothing without a resolved household', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household: null,
      babies: [],
      loading: false,
      selectedBaby: null,
      selectBaby: vi.fn(),
    })

    const { container } = render(<FamilyPage />)

    expect(container).toBeEmptyDOMElement()
  })

  it('lists the babies of the household and the member count', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })

    render(<FamilyPage />)

    expect(screen.getByText('Léo')).toBeInTheDocument()
    expect(screen.getByText('Famille Test — 2 parents')).toBeInTheDocument()
  })

  it('adds a new child with the entered name and birth date', async () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [],
      loading: false,
      selectedBaby: null,
      selectBaby: vi.fn(),
    })
    const user = userEvent.setup()

    render(<FamilyPage />)
    await user.type(screen.getByLabelText('Prénom'), 'Nina')
    await user.type(screen.getByLabelText('Date de naissance'), '2026-01-15')
    await user.click(screen.getByRole('button', { name: 'Add child' }))

    expect(addBaby).toHaveBeenCalledWith('h1', 'Nina', '2026-01-15')
  })
})
