import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { HouseholdProvider } from './contexts/HouseholdContext'
import { ActivityPage } from './pages/ActivityPage'
import { FamilyPage } from './pages/FamilyPage'
import { HistoryPage } from './pages/HistoryPage'
import { LoginPage } from './pages/LoginPage'
import { TrendDetailPage } from './pages/TrendDetailPage'
import { TrendsPage } from './pages/TrendsPage'

function AppShell() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <p role="status" aria-live="polite">
        Loading…
      </p>
    )
  }

  if (!user) return <LoginPage />

  return (
    <HouseholdProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<ActivityPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="trends" element={<TrendsPage />} />
            <Route path="trends/:metricId" element={<TrendDetailPage />} />
            <Route path="family" element={<FamilyPage />} />
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
