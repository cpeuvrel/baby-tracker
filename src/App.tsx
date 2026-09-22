import { AuthProvider, useAuth } from './contexts/AuthContext'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'

function AppShell() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <p role="status" aria-live="polite">
        Chargement…
      </p>
    )
  }

  return user ? <HomePage /> : <LoginPage />
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
