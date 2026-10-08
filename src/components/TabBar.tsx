import { Link, NavLink, useLocation } from 'react-router-dom'
import { HeartsIcon, HomeIcon, LineChartIcon, ListViewIcon } from './icons'

const TABS = [
  { to: '/', label: 'Activity', end: true, Icon: HomeIcon },
  { to: '/history', label: 'History', end: false, Icon: ListViewIcon },
  { to: '/trends', label: 'Trends', end: false, Icon: LineChartIcon },
  { to: '/account', label: 'Family', end: false, Icon: HeartsIcon },
]

const PEDIATRICIAN_PATH = '/account/pediatrician'

/** On the pediatrician screens, History lists the visits (and stays lit on a visit's screens). */
function PediatricianTabs() {
  return (
    <ul>
      <li>
        <Link to="/">
          <HomeIcon />
          Activity
        </Link>
      </li>
      <li>
        <Link to={`${PEDIATRICIAN_PATH}/history`} aria-current="page">
          <ListViewIcon />
          History
        </Link>
      </li>
      <li>
        <Link to="/account">
          <HeartsIcon />
          Family
        </Link>
      </li>
    </ul>
  )
}

export function TabBar() {
  const { pathname } = useLocation()
  const onPediatrician = pathname === PEDIATRICIAN_PATH || pathname.startsWith(`${PEDIATRICIAN_PATH}/`)

  return (
    <nav aria-label="Main navigation" className="tab-bar">
      {onPediatrician ? (
        <PediatricianTabs />
      ) : (
        <ul>
          {TABS.map(({ to, label, end, Icon }) => (
            <li key={to}>
              <NavLink to={to} end={end}>
                <Icon />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}
