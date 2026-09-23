import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth } from '../lib/firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  error: string | null
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const googleProvider = new GoogleAuthProvider()

const ALLOWED_EMAILS = ['amandineandcorentin@gmail.com']

/**
 * signInWithRedirect never completes against the Firebase Auth Emulator on
 * http://localhost (getRedirectResult stays null forever, no error — a known,
 * unresolved bug in the Firebase JS SDK/emulator, not specific to this app).
 * Popup avoids it entirely, so it's used for local dev; redirect is kept for
 * the real deployment (more reliable than popup on mobile, notably iOS Safari).
 */
function usesEmulator(): boolean {
  return import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!usesEmulator()) {
      getRedirectResult(auth).catch(() => {
        setError('Unable to sign in with Google.')
      })
    }

    return onAuthStateChanged(auth, (nextUser) => {
      if (nextUser && !ALLOWED_EMAILS.includes(nextUser.email ?? '')) {
        setError('This Google account is not authorized.')
        void signOut(auth)
        return
      }
      setUser(nextUser)
      setLoading(false)
    })
  }, [])

  const loginWithGoogle = async () => {
    setError(null)
    if (usesEmulator()) {
      try {
        await signInWithPopup(auth, googleProvider)
      } catch {
        setError('Unable to sign in with Google.')
      }
      return
    }
    await signInWithRedirect(auth, googleProvider)
  }

  const logout = async () => {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, loginWithGoogle, logout }}>
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
