import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
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
 * Popup rather than redirect: signInWithRedirect needs storage access shared
 * between the app domain and authDomain (<project>.firebaseapp.com), which
 * browsers now block — the user comes back from Google still signed out. It
 * also never completes against the Auth Emulator on localhost. Redirect would
 * only work by proxying /__/auth/** from the app's own domain.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      if (nextUser && !ALLOWED_EMAILS.includes(nextUser.email ?? '')) {
        setError(`${nextUser.email ?? 'This Google account'} is not authorized.`)
        void signOut(auth)
        return
      }
      setUser(nextUser)
      setLoading(false)
    })
  }, [])

  const loginWithGoogle = async () => {
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch {
      setError('Unable to sign in with Google.')
    }
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
