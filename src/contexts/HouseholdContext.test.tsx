import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Baby, Household } from '../types/models'
import { HouseholdProvider, useHousehold } from './HouseholdContext'

const subscribeToHouseholdForUser = vi.fn()
const subscribeToBabies = vi.fn()

vi.mock('../repositories/households', () => ({
  subscribeToHouseholdForUser: (...args: unknown[]) => subscribeToHouseholdForUser(...args),
}))
vi.mock('../repositories/babies', () => ({
  subscribeToBabies: (...args: unknown[]) => subscribeToBabies(...args),
}))
const mockUser = { uid: 'uid1' } as User
vi.mock('./AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

const household: Household = { id: 'h1', name: 'Famille Test', memberUids: ['uid1'] }
const babies: Baby[] = [
  { id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null },
  { id: 'b2', name: 'Nina', birthDate: '2026-01-15', sex: null },
]

function Probe() {
  const { household: h, babies: b, loading, selectedBaby, selectBaby } = useHousehold()
  return (
    <div>
      <span data-role="loading">{String(loading)}</span>
      <span data-role="household">household:{h?.name ?? 'none'}</span>
      <span data-role="selected">selected:{selectedBaby?.name ?? 'none'}</span>
      {b.map((baby) => (
        <button key={baby.id} type="button" onClick={() => selectBaby(baby.id)}>
          {baby.name}
        </button>
      ))}
    </div>
  )
}

describe('HouseholdContext', () => {
  beforeEach(() => {
    subscribeToHouseholdForUser.mockReset()
    subscribeToBabies.mockReset()
    localStorage.clear()
  })

  it('resolves the household then the babies, defaulting to the first baby', async () => {
    subscribeToHouseholdForUser.mockImplementation((_uid, onChange) => {
      onChange(household)
      return vi.fn()
    })
    subscribeToBabies.mockImplementation((_householdId, onChange) => {
      onChange(babies)
      return vi.fn()
    })

    render(
      <HouseholdProvider>
        <Probe />
      </HouseholdProvider>,
    )

    await waitFor(() => expect(screen.getByText('household:Famille Test')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('selected:Léo')).toBeInTheDocument())
    expect(screen.getByText('false')).toBeInTheDocument()
  })

  it('lets the user pick a different baby and persists the choice', async () => {
    subscribeToHouseholdForUser.mockImplementation((_uid, onChange) => {
      onChange(household)
      return vi.fn()
    })
    subscribeToBabies.mockImplementation((_householdId, onChange) => {
      onChange(babies)
      return vi.fn()
    })
    const user = userEvent.setup()

    render(
      <HouseholdProvider>
        <Probe />
      </HouseholdProvider>,
    )

    await waitFor(() => expect(screen.getByText('selected:Léo')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Nina' }))

    await waitFor(() => expect(screen.getByText('selected:Nina')).toBeInTheDocument())
    expect(localStorage.getItem('baby-tracker:selectedBabyId')).toBe('b2')
  })

  it('stops loading with no household when the user has none', async () => {
    subscribeToHouseholdForUser.mockImplementation((_uid, onChange) => {
      onChange(null)
      return vi.fn()
    })

    render(
      <HouseholdProvider>
        <Probe />
      </HouseholdProvider>,
    )

    await waitFor(() => expect(screen.getByText('false')).toBeInTheDocument())
    expect(screen.getByText('household:none')).toBeInTheDocument()
    expect(subscribeToBabies).not.toHaveBeenCalled()
  })

  it('throws when useHousehold is used outside HouseholdProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('useHousehold must be used within a HouseholdProvider')
    consoleErrorSpy.mockRestore()
  })
})
