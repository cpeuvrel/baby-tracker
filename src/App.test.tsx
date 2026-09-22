import { render, screen, waitFor } from '@testing-library/react'
import type { User } from 'firebase/auth'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createMockAuth } from './test/mockAuthState'

const mockAuth = createMockAuth()

vi.mock('./lib/firebase', () => ({ auth: {} }))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, listener: (user: User | null) => void) =>
    mockAuth.subscribe(listener),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./contexts/HouseholdContext', () => ({
  HouseholdProvider: ({ children }: { children: ReactNode }) => children,
  useHousehold: () => ({
    household: null,
    babies: [],
    loading: false,
    selectedBaby: null,
    selectBaby: vi.fn(),
  }),
}))

const { default: App } = await import('./App')

describe('App', () => {
  it('shows a loading state before the auth listener resolves', () => {
    render(<App />)

    expect(screen.getByRole('status')).toHaveTextContent('Chargement…')
  })

  it('renders the login page when signed out', async () => {
    render(<App />)

    mockAuth.emit(null)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument(),
    )
  })

  it('renders the authenticated shell when signed in', async () => {
    render(<App />)

    mockAuth.emit({ email: 'parent@example.com' } as User)

    await waitFor(() => expect(screen.getByText('parent@example.com')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
  })
})
