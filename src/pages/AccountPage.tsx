import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BlobIcon } from '../components/BlobIcon'
import { BabyAvatarIcon, GearIcon, StethoscopeIcon } from '../components/icons'

function AccountLink({ to, label, colorVar, icon }: { to: string; label: string; colorVar: string; icon: ReactNode }) {
  return (
    <li>
      <Link to={to}>
        <span className="list-row-label">
          <BlobIcon colorVar={colorVar} size="small">
            {icon}
          </BlobIcon>
          <span>{label}</span>
        </span>
        <span className="list-row-chevron" aria-hidden="true">
          ›
        </span>
      </Link>
    </li>
  )
}

export function AccountPage() {
  return (
    <div>
      <h1>Family</h1>
      <ul className="list-group list-group-large">
        <AccountLink to="/account/family" label="Children" colorVar="--category-feeding" icon={<BabyAvatarIcon />} />
        <AccountLink
          to="/account/pediatrician"
          label="Pediatrician"
          colorVar="--category-growth"
          icon={<StethoscopeIcon />}
        />
        <AccountLink to="/account/settings" label="Settings" colorVar="--category-sleep" icon={<GearIcon />} />
      </ul>
    </div>
  )
}
