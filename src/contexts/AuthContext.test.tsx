import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockAuth } from '../test/mockAuthState'
import { AuthProvider, useAuth } from './AuthContext'

const mockAuth = createMockAuth()
const signInWithPopup = vi.fn()
const signInWithRedirect = vi.fn()
const getRedirectResult = vi.fn()
const signOut = vi.fn()

vi.mock('../lib/firebase', () => ({ auth: {} }))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_auth: unknown, listener: (user: User | null) => void) =>
    mockAuth.subscribe(listener),
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args),
  signInWithRedirect: (...args: unknown[]) => signInWithRedirect(...args),
  getRedirectResult: (...args: unknown[]) => getRedirectResult(...args),
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
    signInWithRedirect.mockReset()
    getRedirectResult.mockReset().mockResolvedValue(null)
    signOut.mockReset()
    vi.stubEnv('VITE_USE_FIREBASE_EMULATORS', 'false')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
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

  it('signs out and surfaces an error for a non-whitelisted email', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    mockAuth.emit({ email: 'stranger@example.com' } as User)

    await waitFor(() =>
      expect(screen.getByText('This Google account is not authorized.')).toBeInTheDocument(),
    )
    expect(signOut).toHaveBeenCalledWith({})
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

  describe('outside the emulator (real deployment)', () => {
    it('calls getRedirectResult on mount and surfaces its rejection as an error', async () => {
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

    it('delegates login to signInWithRedirect', async () => {
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
      expect(signInWithPopup).not.toHaveBeenCalled()
    })
  })

  describe('against the emulator (local dev)', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_USE_FIREBASE_EMULATORS', 'true')
    })

    it('does not call getRedirectResult on mount', async () => {
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      )
      mockAuth.emit(null)
      await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument())

      expect(getRedirectResult).not.toHaveBeenCalled()
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
      expect(signInWithRedirect).not.toHaveBeenCalled()
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
  })
})
