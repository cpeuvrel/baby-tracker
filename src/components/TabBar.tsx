import { NavLink } from 'react-router-dom'
import { HomeIcon, LineChartIcon, ListViewIcon, UserIcon } from './icons'

const TABS = [
  { to: '/', label: 'Activity', end: true, Icon: HomeIcon },
  { to: '/history', label: 'History', end: false, Icon: ListViewIcon },
  { to: '/trends', label: 'Trends', end: false, Icon: LineChartIcon },
  { to: '/account', label: 'Account', end: false, Icon: UserIcon },
]

export function TabBar() {
  return (
    <nav aria-label="Main navigation" className="tab-bar">
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
    </nav>
  )
}
