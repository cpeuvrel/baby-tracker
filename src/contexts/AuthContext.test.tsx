import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockAuth } from '../test/mockAuthState'
import { AuthProvider, useAuth } from './AuthContext'

const mockAuth = createMockAuth()
const signInWithPopup = vi.fn()
const signInWithEmailAndPassword = vi.fn()
const createUserWithEmailAndPassword = vi.fn()
const signOut = vi.fn()
const calls: string[] = []
const unregisterPush = vi.fn()
const clearLocalDataAndReload = vi.fn()

vi.mock('../lib/firebase', () => ({
  auth: {},
  usingEmulators: true,
  clearLocalDataAndReload: () => clearLocalDataAndReload(),
}))
vi.mock('../lib/pushRegistration', () => ({ unregisterPush: (uid: string) => unregisterPush(uid) }))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_auth: unknown, listener: (user: User | null) => void) =>
    mockAuth.subscribe(listener),
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => signInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) => createUserWithEmailAndPassword(...args),
  signOut: (...args: unknown[]) => signOut(...args),
}))

function Probe() {
  const { user, loading, error, loginWithGoogle, loginWithPassword, logout } = useAuth()
  return (
    <div>
      <span data-role="status">{loading ? 'loading' : user ? `in:${user.email}` : 'out'}</span>
      <span data-testid="error">{error}</span>
      <button type="button" onClick={() => void loginWithGoogle()}>
        login
      </button>
      <button
        type="button"
        onClick={() => void loginWithPassword('amandineandcorentin@gmail.com', 'password123')}
      >
        local login
      </button>
      <button type="button" onClick={() => void logout()}>
        logout
      </button>
    </div>
  )
}

describe('AuthContext', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    signInWithPopup.mockReset()
    signInWithEmailAndPassword.mockReset()
    createUserWithEmailAndPassword.mockReset()
    calls.length = 0
    signOut.mockReset().mockImplementation(async () => {
      calls.push('signOut')
    })
    unregisterPush.mockReset().mockImplementation(async (uid: string) => {
      calls.push(`unregisterPush:${uid}`)
    })
    clearLocalDataAndReload.mockReset().mockImplementation(async () => {
      calls.push('clearLocalDataAndReload')
    })
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

    mockAuth.emit({ email: 'amandineandcorentin@gmail.com', emailVerified: true } as User)

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

    mockAuth.emit({ email: 'stranger@example.com', emailVerified: true } as User)

    await waitFor(() =>
      expect(screen.getByText('stranger@example.com is not authorized.')).toBeInTheDocument(),
    )
    expect(signOut).toHaveBeenCalledWith({})
  })

  it('signs out an allowlisted account whose email is not verified', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    mockAuth.emit({ email: 'amandineandcorentin@gmail.com', emailVerified: false } as User)

    await waitFor(() =>
      expect(screen.getByText('amandineandcorentin@gmail.com is not verified.')).toBeInTheDocument(),
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
    signInWithPopup.mockRejectedValue({ code: 'auth/network-request-failed' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
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

  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])(
    'shows no error when the popup is dismissed (%s)',
    async (code) => {
      signInWithPopup.mockRejectedValue({ code })
      const user = userEvent.setup()
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      )
      mockAuth.emit(null)
      await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: 'login' }))

      await waitFor(() => expect(signInWithPopup).toHaveBeenCalled())
      expect(screen.getByTestId('error')).toBeEmptyDOMElement()
    },
  )

  it('unregisters this device, signs out, then clears the local data', async () => {
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    mockAuth.emit({ uid: 'uid1', email: 'amandineandcorentin@gmail.com', emailVerified: true } as User)
    await waitFor(() => expect(screen.getByText('in:amandineandcorentin@gmail.com')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'logout' }))

    await waitFor(() =>
      expect(calls).toEqual(['unregisterPush:uid1', 'signOut', 'clearLocalDataAndReload']),
    )
    expect(signOut).toHaveBeenCalledWith({})
  })

  it('surfaces a sign-out failure and keeps the local data', async () => {
    signOut.mockRejectedValue({ code: 'auth/network-request-failed' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    mockAuth.emit({ uid: 'uid1', email: 'amandineandcorentin@gmail.com', emailVerified: true } as User)
    await waitFor(() => expect(screen.getByText('in:amandineandcorentin@gmail.com')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'logout' }))

    await waitFor(() =>
      expect(screen.getByText('Unable to sign out. (auth/network-request-failed)')).toBeInTheDocument(),
    )
    expect(clearLocalDataAndReload).not.toHaveBeenCalled()
  })

  it('leaves the loading state for a rejected account instead of hanging', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    mockAuth.emit({ email: 'stranger@example.com', emailVerified: true } as User)

    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument())
  })

  it('signs in locally with email and password', async () => {
    signInWithEmailAndPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    mockAuth.emit(null)
    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'local login' }))

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      {},
      'amandineandcorentin@gmail.com',
      'password123',
    )
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled()
  })

  it('creates the test account on the emulator when it does not exist yet', async () => {
    signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/user-not-found' })
    createUserWithEmailAndPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    mockAuth.emit(null)
    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'local login' }))

    await waitFor(() =>
      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        {},
        'amandineandcorentin@gmail.com',
        'password123',
      ),
    )
  })

  it('throws when useAuth is used outside AuthProvider', () => {
    const ConsoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('useAuth must be used within an AuthProvider')
    ConsoleErrorSpy.mockRestore()
  })
})
