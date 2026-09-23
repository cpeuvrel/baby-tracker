import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { formatAge } from '../lib/age'

export function FamilyPage() {
  const { user } = useAuth()
  const { household, babies } = useHousehold()
  const now = new Date()

  if (!household) return null

  return (
    <div>
      <div className="detail-header">
        <Link to="/account" aria-label="Back">
          ‹
        </Link>
        <h2>Family</h2>
      </div>

      <section aria-label="Children">
        <h2>Children</h2>
        <ul className="list-group">
          {babies.map((baby) => (
            <li key={baby.id}>
              <Link to={`/account/family/${baby.id}`}>
                <span>{baby.name}</span>
                <span className="list-group-trailing">
                  <span className="list-group-meta">Age {formatAge(baby.birthDate, now)}</span>
                  <span className="list-row-chevron" aria-hidden="true">
                    ›
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/account/family/add" className="link-button">
          Add child
        </Link>
      </section>

      <section aria-label="Parents">
        <h2>Caregivers</h2>
        <ul className="list-group">
          <li>
            <span>{user?.email}</span>
            <span className="list-group-meta">Your Profile</span>
          </li>
          {household.memberUids
            .filter((uid) => uid !== user?.uid)
            .map((uid) => (
              <li key={uid}>
                <span>Other caregiver</span>
                <span className="list-group-meta">{uid.slice(0, 8)}…</span>
              </li>
            ))}
        </ul>
        <p className="hint">
          Both parents sign in with the same shared Google account, so there is no separate
          caregiver account to add from the app.
        </p>
      </section>
    </div>
  )
}
