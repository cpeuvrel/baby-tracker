import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import { FamilyPage } from './FamilyPage'

const addBaby = vi.fn()
const updateBaby = vi.fn()

vi.mock('../repositories/babies', () => ({
  addBaby: (...args: unknown[]) => addBaby(...args),
  updateBaby: (...args: unknown[]) => updateBaby(...args),
}))

const household = { id: 'h1', name: 'Famille Test', memberUids: ['uid1', 'uid2'] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

describe('FamilyPage', () => {
  beforeEach(() => {
    addBaby.mockReset()
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { uid: 'uid1', email: 'parent1@example.com' } as User,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    })
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

  it('lists the babies of the household with their age', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })

    render(<FamilyPage />)

    expect(screen.getByText('Léo')).toBeInTheDocument()
    expect(screen.getByText(/^Age /)).toBeInTheDocument()
  })

  it('lists the current user as "Your Profile" and other members generically', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })

    render(<FamilyPage />)

    expect(screen.getByText('parent1@example.com')).toBeInTheDocument()
    expect(screen.getByText('Your Profile')).toBeInTheDocument()
    expect(screen.getByText('Other caregiver')).toBeInTheDocument()
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
    await user.type(screen.getByLabelText('First name'), 'Nina')
    await user.type(screen.getByLabelText('Date of birth'), '2026-01-15')
    await user.click(screen.getByRole('button', { name: 'Add child' }))

    expect(addBaby).toHaveBeenCalledWith('h1', 'Nina', '2026-01-15')
  })
})
