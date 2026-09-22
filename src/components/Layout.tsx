import { Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ActiveTimersBanner } from './ActiveTimersBanner'
import { BabySelector } from './BabySelector'
import { TabBar } from './TabBar'

export function Layout() {
  const { logout } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <BabySelector />
        <button type="button" className="link-button" onClick={() => void logout()}>
          Se déconnecter
        </button>
      </header>
      <ActiveTimersBanner />
      <main className="app-content">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
