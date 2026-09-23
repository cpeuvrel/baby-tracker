import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockAuth } from '../test/mockAuthState'
import { AuthProvider, useAuth } from './AuthContext'

const mockAuth = createMockAuth()
const signInWithRedirect = vi.fn()
const getRedirectResult = vi.fn()
const signOut = vi.fn()

vi.mock('../lib/firebase', () => ({ auth: {} }))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_auth: unknown, listener: (user: User | null) => void) =>
    mockAuth.subscribe(listener),
  getRedirectResult: (...args: unknown[]) => getRedirectResult(...args),
  signInWithRedirect: (...args: unknown[]) => signInWithRedirect(...args),
  signOut: (...args: unknown[]) => signOut(...args),
}))

function Probe() {
  const { user, loading, error, loginWithGoogle, logout } = useAuth()
  return (
    <div>
      <span data-role="status">{loading ? 'loading' : user ? `in:${user.email}` : 'out'}</span>
      <span data-role="error">{error}</span>
      <button type="button" onClick={() => void loginWithGoogle()}>
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
    signInWithRedirect.mockReset()
    getRedirectResult.mockReset().mockResolvedValue(null)
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

  it('delegates loginWithGoogle to signInWithRedirect', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    mockAuth.emit(null)
    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'login' }))

    expect(signInWithRedirect).toHaveBeenCalledWith({}, {})
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

  it('surfaces an error when getRedirectResult rejects', async () => {
    getRedirectResult.mockReset().mockRejectedValue(new Error('auth/unauthorized-domain'))

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    mockAuth.emit(null)

    await waitFor(() =>
      expect(screen.getByText('Unable to sign in with Google.')).toBeInTheDocument(),
    )
  })

  it('throws when useAuth is used outside AuthProvider', () => {
    const ConsoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('useAuth must be used within an AuthProvider')
    ConsoleErrorSpy.mockRestore()
  })
})
