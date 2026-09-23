import { useAuth } from '../contexts/AuthContext'

export function LoginPage() {
  const { loginWithGoogle, error } = useAuth()

  return (
    <main>
      <h1>Baby Tracker</h1>
      <button type="button" onClick={() => void loginWithGoogle()}>
        Sign in with Google
      </button>
      <p role="alert" aria-live="polite">
        {error}
      </p>
    </main>
  )
}
