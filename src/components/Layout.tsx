import { Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ActiveTimersBanner } from './ActiveTimersBanner'
import { BabySelector } from './BabySelector'
import { BabyAvatarIcon } from './icons'
import { TabBar } from './TabBar'

function formatHeaderDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function Layout() {
  const { logout } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-baby">
          <span className="app-header-avatar" aria-hidden="true">
            <BabyAvatarIcon />
          </span>
          <div>
            <BabySelector />
            <p className="app-header-date">{formatHeaderDate(new Date())}</p>
          </div>
        </div>
        <details className="app-header-menu">
          <summary role="button" aria-label="Menu">
            ⋯
          </summary>
          <div className="app-header-menu-panel">
            <button type="button" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </details>
      </header>
      <ActiveTimersBanner />
      <main className="app-content">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
