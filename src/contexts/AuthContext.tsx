import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth, clearLocalDataAndReload, usingEmulators } from '../lib/firebase'
import { unregisterPush } from '../lib/pushRegistration'

interface AuthContextValue {
  user: User | null
  loading: boolean
  error: string | null
  /** True in dev on the emulator: the local email/password sign-in is offered. */
  devLoginAvailable: boolean
  loginWithGoogle: () => Promise<void>
  loginWithPassword: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const googleProvider = new GoogleAuthProvider()

const ALLOWED_EMAILS = ['amandineandcorentin@gmail.com']

// The user closed the popup, or a second click replaced it: not an error to show.
const DISMISSED_POPUP_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])

function describeError(fallback: string, cause: unknown): string {
  const code = (cause as { code?: string } | null)?.code
  return code ? `${fallback} (${code})` : fallback
}

/**
 * Popup rather than redirect: signInWithRedirect needs storage access shared
 * between the app domain and authDomain (<project>.firebaseapp.com), which
 * browsers now block — the user comes back from Google still signed out. It
 * also never completes against the Auth Emulator on localhost. Redirect would
 * only work by proxying /__/auth/** from the app's own domain.
 *
 * In dev on the emulator, loginWithPassword short-circuits the whole Google
 * flow (popup, postMessage, iframe) so tests don't depend on Google.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return onAuthStateChanged(
      auth,
      (nextUser) => {
        if (nextUser && !ALLOWED_EMAILS.includes(nextUser.email ?? '')) {
          setError(`${nextUser.email ?? 'This Google account'} is not authorized.`)
          setUser(null)
          setLoading(false)
          void signOut(auth).catch((cause: unknown) => console.error('[auth] signOut failed', cause))
          return
        }
        setUser(nextUser)
        setLoading(false)
      },
      (listenerError) => {
        // Without this handler, a listener failure leaves the app on "Loading…" forever.
        console.error('[auth] onAuthStateChanged failed', listenerError)
        setError(describeError('Authentication is unavailable.', listenerError))
        setUser(null)
        setLoading(false)
      },
    )
  }, [])

  const loginWithGoogle = async () => {
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (cause) {
      if (DISMISSED_POPUP_CODES.has((cause as { code?: string } | null)?.code ?? '')) return
      console.error('[auth] signInWithPopup failed', cause)
      setError('Unable to sign in with Google.')
    }
  }

  const loginWithPassword = async (email: string, password: string) => {
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (cause) {
      const code = (cause as { code?: string } | null)?.code
      const missingAccount =
        code === 'auth/user-not-found' || code === 'auth/invalid-credential'
      // On the Auth Emulator the test account is disposable: it's created on the fly.
      if (usingEmulators && missingAccount) {
        try {
          await createUserWithEmailAndPassword(auth, email, password)
          return
        } catch (createCause) {
          console.error('[auth] createUserWithEmailAndPassword failed', createCause)
          setError(describeError('Unable to create the local test account.', createCause))
          return
        }
      }
      console.error('[auth] signInWithEmailAndPassword failed', cause)
      setError(describeError('Unable to sign in with this email and password.', cause))
    }
  }

  /**
   * Unregisters this device from the household's pushes (while still signed
   * in: only the owner may delete its token), signs out, then clears the data
   * cached on this device and reloads.
   */
  const logout = async () => {
    setError(null)
    try {
      if (user) await unregisterPush(user.uid)
      await signOut(auth)
    } catch (cause) {
      console.error('[auth] signOut failed', cause)
      setError(describeError('Unable to sign out.', cause))
      return
    }
    await clearLocalDataAndReload()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        devLoginAvailable: usingEmulators,
        loginWithGoogle,
        loginWithPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
