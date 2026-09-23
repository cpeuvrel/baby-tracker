import { render, screen, waitFor } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockAuth } from './test/mockAuthState'

const mockAuth = createMockAuth()
const subscribeToHouseholdForUser = vi.fn()
const subscribeToBabies = vi.fn()

vi.mock('./lib/firebase', () => ({ auth: {} }))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_auth: unknown, listener: (user: User | null) => void) =>
    mockAuth.subscribe(listener),
  getRedirectResult: vi.fn().mockResolvedValue(null),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./repositories/households', () => ({
  subscribeToHouseholdForUser: (...args: unknown[]) => subscribeToHouseholdForUser(...args),
  createHousehold: vi.fn(),
}))
vi.mock('./repositories/babies', () => ({
  subscribeToBabies: (...args: unknown[]) => subscribeToBabies(...args),
  addBaby: vi.fn(),
}))

const { default: App } = await import('./App')

describe('App', () => {
  beforeEach(() => {
    subscribeToHouseholdForUser.mockReset()
    subscribeToBabies.mockReset()
  })

  it('shows a loading state before the auth listener resolves', () => {
    render(<App />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  })

  it('renders the login page when signed out', async () => {
    render(<App />)

    mockAuth.emit(null)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument(),
    )
  })

  it('offers to create a family when signed in with no household yet', async () => {
    subscribeToHouseholdForUser.mockImplementation((_uid, onChange) => {
      onChange(null)
      return vi.fn()
    })

    render(<App />)
    mockAuth.emit({ uid: 'uid1', email: 'amandineandcorentin@gmail.com' } as User)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add child' })).toBeInTheDocument(),
    )
  })

  it('renders the authenticated shell once a household exists', async () => {
    subscribeToHouseholdForUser.mockImplementation((_uid, onChange) => {
      onChange({ id: 'h1', name: 'Famille Test', memberUids: ['uid1'] })
      return vi.fn()
    })
    subscribeToBabies.mockImplementation((_householdId, onChange) => {
      onChange([])
      return vi.fn()
    })

    render(<App />)
    mockAuth.emit({ uid: 'uid1', email: 'amandineandcorentin@gmail.com' } as User)

    await waitFor(() => expect(screen.getByRole('link', { name: 'Activity' })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Account' })).toBeInTheDocument()
  })
})
