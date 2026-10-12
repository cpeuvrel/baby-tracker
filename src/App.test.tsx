import { render, screen, waitFor } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockAuth } from './test/mockAuthState'

const mockAuth = createMockAuth()
const subscribeToHouseholdForUser = vi.fn()
const subscribeToBabies = vi.fn()

vi.mock('./lib/firebase', () => ({ auth: {}, usingEmulators: false }))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_auth: unknown, listener: (user: User | null) => void) =>
    mockAuth.subscribe(listener),
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
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

// Lets a test make the login screen throw while rendering.
let loginPageThrows = false
vi.mock('./pages/LoginPage', async (importOriginal) => {
  const { LoginPage } = await importOriginal<typeof import('./pages/LoginPage')>()
  return {
    LoginPage: () => {
      if (loginPageThrows) throw new Error('boom')
      return <LoginPage />
    },
  }
})

// The tracking screens' own data hooks are beside the point here.
vi.mock('./pages/ActivityPage', () => ({ ActivityPage: () => <p>Activity screen</p> }))
vi.mock('./components/ActiveTimersBanner', () => ({ ActiveTimersBanner: () => null }))

const { default: App } = await import('./App')

describe('App', () => {
  beforeEach(() => {
    subscribeToHouseholdForUser.mockReset()
    subscribeToBabies.mockReset()
    loginPageThrows = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.history.replaceState({}, '', '/')
  })

  function signInToFamily(babies: { id: string; name: string; birthDate: string; sex: null }[] = []) {
    subscribeToHouseholdForUser.mockImplementation((_uid, onChange) => {
      onChange({ id: 'h1', name: 'Famille Test', memberUids: ['uid1'] })
      return vi.fn()
    })
    subscribeToBabies.mockImplementation((_householdId, onChange) => {
      onChange(babies)
      return vi.fn()
    })
    render(<App />)
    mockAuth.emit({ uid: 'uid1', email: 'amandineandcorentin@gmail.com', emailVerified: true } as User)
  }

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

  it('shows a Reload button instead of a blank page when a screen throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    loginPageThrows = true
    render(<App />)

    mockAuth.emit(null)

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('offers to create a family when signed in with no household yet', async () => {
    subscribeToHouseholdForUser.mockImplementation((_uid, onChange) => {
      onChange(null)
      return vi.fn()
    })

    render(<App />)
    mockAuth.emit({ uid: 'uid1', email: 'amandineandcorentin@gmail.com', emailVerified: true } as User)

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
    mockAuth.emit({ uid: 'uid1', email: 'amandineandcorentin@gmail.com', emailVerified: true } as User)

    await waitFor(() => expect(screen.getByRole('link', { name: 'Activity' })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Family' })).toBeInTheDocument()
  })

  it('sends an unknown address to the home screen', async () => {
    window.history.replaceState({}, '', '/no-such-screen')

    signInToFamily([{ id: 'b1', name: 'Léo', birthDate: '2025-06-01', sex: null }])

    expect(await screen.findByText('Activity screen')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })
})
