import { Outlet } from 'react-router-dom'
import { formatDate } from '../lib/appTime'
import { ActiveTimersBanner } from './ActiveTimersBanner'
import { BabySelector } from './BabySelector'
import { BabyAvatarIcon } from './icons'
import { TabBar } from './TabBar'

function formatHeaderDate(date: Date): string {
  return formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function Layout() {
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
      </header>
      <ActiveTimersBanner />
      <main className="app-content">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
