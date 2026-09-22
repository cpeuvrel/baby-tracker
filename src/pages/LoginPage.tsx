import { FirebaseError } from 'firebase/app'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      const message =
        err instanceof FirebaseError ? 'Email ou mot de passe incorrect.' : 'Connexion impossible.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main>
      <h1>Baby Tracker</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button type="submit" disabled={submitting}>
          Se connecter
        </button>
        <p role="alert" aria-live="polite">
          {error}
        </p>
      </form>
    </main>
  )
}
