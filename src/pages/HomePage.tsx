import { useAuth } from '../contexts/AuthContext'

export function HomePage() {
  const { user, logout } = useAuth()

  return (
    <main>
      <h1>Baby Tracker</h1>
      <p>Connecté en tant que {user?.email}</p>
      <button type="button" onClick={() => void logout()}>
        Se déconnecter
      </button>
    </main>
  )
}
