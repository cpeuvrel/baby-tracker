import { Link, Navigate } from 'react-router-dom'
import { useHousehold } from '../contexts/HouseholdContext'
import { usePediatricianVisitsState } from '../hooks/usePediatricianVisits'
import { upcomingVisits } from '../lib/upcomingVisits'
import { todayDateValue } from '../lib/visitDate'

/** Entry point: opens the next upcoming visit, or the history when none is planned. */
export function PediatricianPage() {
  const { household, selectedBaby } = useHousehold()
  const { visits, error } = usePediatricianVisitsState(household?.id ?? null, selectedBaby?.id ?? null)

  if (error) {
    return (
      <div>
        <div className="detail-header">
          <Link to="/account" aria-label="Back">
            ‹
          </Link>
          <h2>Pediatrician</h2>
        </div>
        <p role="alert">Unable to load the visits ({error.message}).</p>
      </div>
    )
  }
  if (visits === null) {
    return (
      <p role="status" aria-live="polite">
        Loading…
      </p>
    )
  }
  const next = upcomingVisits(visits, todayDateValue())[0]
  if (next) return <Navigate to={`/account/pediatrician/visits/${next.id}`} replace />
  return <Navigate to="/account/pediatrician/history" replace />
}
