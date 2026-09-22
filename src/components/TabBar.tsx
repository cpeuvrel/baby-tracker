import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Suivi', end: true },
  { to: '/stats', label: 'Stats', end: false },
  { to: '/growth', label: 'Croissance', end: false },
]

export function TabBar() {
  return (
    <nav aria-label="Navigation principale">
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
