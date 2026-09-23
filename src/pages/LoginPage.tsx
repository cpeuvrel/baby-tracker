import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'

const DEV_EMAIL = 'amandineandcorentin@gmail.com'
const DEV_PASSWORD = 'password123'

export function LoginPage() {
  const { loginWithGoogle, loginWithPassword, devLoginAvailable, error } = useAuth()
  const [email, setEmail] = useState(DEV_EMAIL)
  const [password, setPassword] = useState(DEV_PASSWORD)
  const [submitting, setSubmitting] = useState(false)

  const handleDevLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    await loginWithPassword(email.trim(), password)
    setSubmitting(false)
  }

  return (
    <main>
      <h1>Baby Tracker</h1>
      <button type="button" onClick={() => void loginWithGoogle()}>
        Sign in with Google
      </button>

      {devLoginAvailable && (
        <form onSubmit={(event) => void handleDevLogin(event)}>
          <h2>Local sign-in (emulator)</h2>
          <div>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button type="submit" disabled={submitting}>
            Sign in locally
          </button>
        </form>
      )}

      <p role="alert" aria-live="polite">
        {error}
      </p>
    </main>
  )
}
