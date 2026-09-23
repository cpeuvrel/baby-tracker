import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockAuth } from '../test/mockAuthState'
import { AuthProvider, useAuth } from './AuthContext'

const mockAuth = createMockAuth()
const signInWithPopup = vi.fn()
const signOut = vi.fn()

vi.mock('../lib/firebase', () => ({ auth: {} }))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_auth: unknown, listener: (user: User | null) => void) =>
    mockAuth.subscribe(listener),
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args),
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
    signInWithPopup.mockReset()
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

    mockAuth.emit({ email: 'amandineandcorentin@gmail.com' } as User)

    await waitFor(() =>
      expect(screen.getByText('in:amandineandcorentin@gmail.com')).toBeInTheDocument(),
    )
  })

  it('signs out and names the rejected account for a non-whitelisted email', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    mockAuth.emit({ email: 'stranger@example.com' } as User)

    await waitFor(() =>
      expect(screen.getByText('stranger@example.com is not authorized.')).toBeInTheDocument(),
    )
    expect(signOut).toHaveBeenCalledWith({})
  })

  it('delegates login to signInWithPopup', async () => {
    signInWithPopup.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    mockAuth.emit(null)
    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'login' }))

    expect(signInWithPopup).toHaveBeenCalledWith({}, {})
  })

  it('surfaces an error when signInWithPopup rejects', async () => {
    signInWithPopup.mockRejectedValue(new Error('auth/popup-closed-by-user'))
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    mockAuth.emit(null)
    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'login' }))

    await waitFor(() =>
      expect(screen.getByText('Unable to sign in with Google.')).toBeInTheDocument(),
    )
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
