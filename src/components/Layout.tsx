import { Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ActiveTimersBanner } from './ActiveTimersBanner'
import { TabBar } from './TabBar'

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div>
      <header>
        <h1>Baby Tracker</h1>
        <p>
          {user?.email}{' '}
          <button type="button" onClick={() => void logout()}>
            Se déconnecter
          </button>
        </p>
      </header>
      <TabBar />
      <ActiveTimersBanner />
      <Outlet />
    </div>
  )
}
