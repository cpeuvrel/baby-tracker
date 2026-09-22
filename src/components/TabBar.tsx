import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Activity', end: true },
  { to: '/history', label: 'History', end: false },
  { to: '/trends', label: 'Trends', end: false },
  { to: '/family', label: 'Account', end: false },
]

export function TabBar() {
  return (
    <nav aria-label="Navigation principale" className="tab-bar">
      <ul>
        {TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink to={tab.to} end={tab.end}>
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
