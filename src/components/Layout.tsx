import { useEffect, useState } from 'react'
import { Outlet, useMatch, useNavigate } from 'react-router-dom'
import { useHousehold } from '../contexts/HouseholdContext'
import { formatDate } from '../lib/appTime'
import { routeForegroundPushes } from '../lib/foregroundPush'
import { ActiveTimersBanner } from './ActiveTimersBanner'
import { BabySelector } from './BabySelector'
import { BabyAvatarIcon, MoreIcon } from './icons'
import { SummarySheet } from './SummarySheet'
import { TabBar } from './TabBar'

// A path on this origin: "//host" and "/\host" would be read as another site.
const SAME_ORIGIN_PATH = /^\/(?![/\\])/

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
    const serviceWorker = navigator.serviceWorker
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null
      if (data?.type === 'navigate' && typeof data.url === 'string' && SAME_ORIGIN_PATH.test(data.url)) {
        navigate(data.url)
      }
    }
    serviceWorker.addEventListener('message', onMessage)
    return () => serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    let cancelled = false
    void routeForegroundPushes()
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
