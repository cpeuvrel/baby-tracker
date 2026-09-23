import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockAuth } from '../test/mockAuthState'
import { AuthProvider, useAuth } from './AuthContext'

const mockAuth = createMockAuth()
const signInWithEmailAndPassword = vi.fn()
const signOut = vi.fn()

vi.mock('../lib/firebase', () => ({ auth: {} }))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, listener: (user: User | null) => void) =>
    mockAuth.subscribe(listener),
  signInWithEmailAndPassword: (...args: unknown[]) => signInWithEmailAndPassword(...args),
  signOut: (...args: unknown[]) => signOut(...args),
}))

function Probe() {
  const { user, loading, login, logout } = useAuth()
  return (
    <div>
      <span data-role="status">{loading ? 'loading' : user ? `in:${user.email}` : 'out'}</span>
      <button type="button" onClick={() => void login('a@example.com', 'secret')}>
        login
      </button>
      <button type="button" onClick={() => void logout()}>
        logout
      </button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    signInWithEmailAndPassword.mockReset()
    signOut.mockReset()
  })

  it('starts in loading state then reflects a signed-out user', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(screen.getByText('loading')).toBeInTheDocument()

    mockAuth.emit(null)

    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument())
  })

  it('reflects a signed-in user once the auth listener fires', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    mockAuth.emit({ email: 'parent@example.com' } as User)

    await waitFor(() =>
      expect(screen.getByText('in:parent@example.com')).toBeInTheDocument(),
    )
  })

  it('delegates login to signInWithEmailAndPassword', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    mockAuth.emit(null)
    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'login' }))

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith({}, 'a@example.com', 'secret')
  })

  it('delegates logout to signOut', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    mockAuth.emit(null)
    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'logout' }))

    expect(signOut).toHaveBeenCalledWith({})
  })

  it('throws when useAuth is used outside AuthProvider', () => {
    const ConsoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('useAuth must be used within an AuthProvider')
    ConsoleErrorSpy.mockRestore()
  })
})
