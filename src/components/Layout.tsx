import { useState } from 'react'
import { Outlet, useMatch } from 'react-router-dom'
import { useHousehold } from '../contexts/HouseholdContext'
import { formatDate } from '../lib/appTime'
import { ActiveTimersBanner } from './ActiveTimersBanner'
import { BabySelector } from './BabySelector'
import { BabyAvatarIcon, MoreIcon } from './icons'
import { SummarySheet } from './SummarySheet'
import { TabBar } from './TabBar'

function formatHeaderDate(date: Date): string {
  return formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function Layout() {
  const { selectedBaby } = useHousehold()
  const onActivityScreen = useMatch({ path: '/', end: true }) != null
  const [summaryOpen, setSummaryOpen] = useState(false)

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-baby">
          <span className="app-header-avatar" aria-hidden="true">
            {selectedBaby?.photoDataUrl ? <img src={selectedBaby.photoDataUrl} alt="" /> : <BabyAvatarIcon />}
          </span>
          <div className="app-header-identity">
            <BabySelector />
            <p className="app-header-date">{formatHeaderDate(new Date())}</p>
          </div>
        </div>
        {onActivityScreen && (
          <button
            type="button"
            className="app-header-button"
            aria-label="Summary"
            onClick={() => setSummaryOpen(true)}
          >
            <MoreIcon />
          </button>
        )}
      </header>
      <ActiveTimersBanner />
      <main className="app-content">
        <Outlet />
      </main>
      <TabBar />
      {summaryOpen && <SummarySheet onClose={() => setSummaryOpen(false)} />}
    </div>
  )
}
