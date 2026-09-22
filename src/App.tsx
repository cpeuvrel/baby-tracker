import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { HouseholdProvider } from './contexts/HouseholdContext'
import { LoginPage } from './pages/LoginPage'
import { TrackingPage } from './pages/TrackingPage'

function AppShell() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <p role="status" aria-live="polite">
        Chargement…
      </p>
    )
  }

  if (!user) return <LoginPage />

  return (
    <HouseholdProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<TrackingPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </HouseholdProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
