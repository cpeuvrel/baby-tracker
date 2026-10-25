import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { useHousehold } from '../contexts/HouseholdContext'
import { useNow } from '../hooks/useNow'
import { formatDate } from '../lib/appTime'
import { ActiveTimersBanner } from './ActiveTimersBanner'
import { AppErrorBoundary } from './AppErrorBoundary'
import { BabySelector } from './BabySelector'
import { EmptyState } from './EmptyState'
import { BabyAvatarIcon, MoreIcon } from './icons'
import { SummarySheet } from './SummarySheet'
import { TabBar } from './TabBar'

// A path on this origin: "//host" and "/\host" would be read as another site.
const SAME_ORIGIN_PATH = /^\/(?![/\\])/

function formatHeaderDate(date: Date): string {
  return formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function Layout() {
  const { babies, selectedBaby } = useHousehold()
  const onActivityScreen = useMatch({ path: '/', end: true }) != null
  const [summaryOpen, setSummaryOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const now = useNow()
  // Without a child (e.g. the last one was deleted) the tracking screens have nothing to show;
  // the Family screens stay reachable to add one.
  const onAccountScreens = pathname === '/account' || pathname.startsWith('/account/')
  const noChildYet = babies.length === 0 && !onAccountScreens

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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-baby">
          <span className="app-header-avatar" aria-hidden="true">
            {selectedBaby?.photoDataUrl ? <img src={selectedBaby.photoDataUrl} alt="" /> : <BabyAvatarIcon />}
          </span>
          <div className="app-header-identity">
            <BabySelector />
            <p className="app-header-date">{formatHeaderDate(now)}</p>
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
        {/* A screen that fails keeps the header and tab bar: another tab gets a fresh try. */}
        <AppErrorBoundary resetKey={pathname}>
          {noChildYet ? (
            <EmptyState colorVar="--category-feeding" icon={<BabyAvatarIcon />}>
              No child yet. <Link to="/account/family/add">Add a child</Link>
            </EmptyState>
          ) : (
            <Outlet />
          )}
        </AppErrorBoundary>
      </main>
      <TabBar />
      {summaryOpen && <SummarySheet onClose={() => setSummaryOpen(false)} />}
    </div>
  )
}
