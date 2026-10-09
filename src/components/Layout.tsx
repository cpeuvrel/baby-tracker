import { useEffect, useState } from 'react'
import { Outlet, useMatch, useNavigate } from 'react-router-dom'
import { useHousehold } from '../contexts/HouseholdContext'
import { formatDate } from '../lib/appTime'
import { showVaccinePushesInForeground } from '../lib/foregroundPush'
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
  const navigate = useNavigate()

  // The service worker forwards notification taps here (see sw.ts).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null
      if (data?.type === 'navigate' && typeof data.url === 'string' && data.url.startsWith('/')) navigate(data.url)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    let cancelled = false
    void showVaccinePushesInForeground()
      .then((stop) => (cancelled ? stop() : (unsubscribe = stop)))
      .catch(() => {})
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

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
