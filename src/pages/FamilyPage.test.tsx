import { render, screen } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as AuthContext from '../contexts/AuthContext'
import * as HouseholdContext from '../contexts/HouseholdContext'
import { FamilyPage } from './FamilyPage'

const household = { id: 'h1', name: 'Famille Test', memberUids: ['uid1', 'uid2'] }
const baby = { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }

function renderPage() {
  return render(
    <MemoryRouter>
      <FamilyPage />
    </MemoryRouter>,
  )
}

describe('FamilyPage', () => {
  beforeEach(() => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { uid: 'uid1', email: 'parent1@example.com' } as User,
      loading: false,
      error: null,
      devLoginAvailable: false,
      loginWithGoogle: vi.fn(),
      loginWithPassword: vi.fn(),
      logout: vi.fn(),
    })
  })

  it('renders nothing without a resolved household', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household: null,
      babies: [],
      loading: false,
      error: null,
      selectedBaby: null,
      selectBaby: vi.fn(),
    })

    const { container } = renderPage()

    expect(container).toBeEmptyDOMElement()
  })

  it('lists the babies of the household with their age, linking to their Child screen', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      error: null,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })

    renderPage()

    expect(screen.getByText('Léo')).toBeInTheDocument()
    expect(screen.getByText(/^Age /)).toBeInTheDocument()
    expect(screen.getByText('Léo').closest('a')).toHaveAttribute('href', '/account/family/b1')
  })

  it('links "Add child" to the Add Child screen', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [],
      loading: false,
      error: null,
      selectedBaby: null,
      selectBaby: vi.fn(),
    })

    renderPage()

    expect(screen.getByRole('link', { name: 'Add child' })).toHaveAttribute(
      'href',
      '/account/family/add',
    )
  })

  it('lists the current user as "Your Profile" and other members generically', () => {
    vi.spyOn(HouseholdContext, 'useHousehold').mockReturnValue({
      household,
      babies: [baby],
      loading: false,
      error: null,
      selectedBaby: baby,
      selectBaby: vi.fn(),
    })

    renderPage()

    expect(screen.getByText('parent1@example.com')).toBeInTheDocument()
    expect(screen.getByText('Your Profile')).toBeInTheDocument()
    expect(screen.getByText('Other caregiver')).toBeInTheDocument()
  })
})
