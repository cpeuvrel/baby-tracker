import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { HouseholdProvider, useHousehold } from './contexts/HouseholdContext'
import { AccountPage } from './pages/AccountPage'
import { AccountSettingsPage } from './pages/AccountSettingsPage'
import { ActivityPage } from './pages/ActivityPage'
import { AddChildPage } from './pages/AddChildPage'
import { ChildPage } from './pages/ChildPage'
import { CreateFamilyPage } from './pages/CreateFamilyPage'
import { EditActivitiesPage } from './pages/EditActivitiesPage'
import { FamilyPage } from './pages/FamilyPage'
import { GrowthDetailPage } from './pages/GrowthDetailPage'
import { HistoryPage } from './pages/HistoryPage'
import { LoginPage } from './pages/LoginPage'
import { NighttimeHoursPage } from './pages/NighttimeHoursPage'
import { TrendDetailPage } from './pages/TrendDetailPage'
import { TrendsPage } from './pages/TrendsPage'

function AuthenticatedApp() {
  const { household, loading } = useHousehold()

  if (loading) {
    return (
      <p role="status" aria-live="polite">
        Loading…
      </p>
    )
  }

  if (!household) return <CreateFamilyPage />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ActivityPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="trends" element={<TrendsPage />} />
          <Route path="trends/:metricId" element={<TrendDetailPage />} />
          <Route path="growth/:metric" element={<GrowthDetailPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="account/settings" element={<AccountSettingsPage />} />
          <Route path="account/family" element={<FamilyPage />} />
          <Route path="account/family/add" element={<AddChildPage />} />
          <Route path="account/family/:babyId" element={<ChildPage />} />
          <Route path="account/family/:babyId/activities" element={<EditActivitiesPage />} />
          <Route path="account/family/:babyId/nighttime-hours" element={<NighttimeHoursPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

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
      <AuthenticatedApp />
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
