import { Navigate } from 'react-router-dom'
import { useHousehold } from '../contexts/HouseholdContext'
import { usePediatricianVisits } from '../hooks/usePediatricianVisits'
import { upcomingVisits } from '../lib/upcomingVisits'
import { todayDateValue } from '../lib/visitDate'

/** Entry point: opens the next upcoming visit, or the history when none is planned. */
export function PediatricianPage() {
  const { household, selectedBaby } = useHousehold()
  const visits = usePediatricianVisits(household?.id ?? null, selectedBaby?.id ?? null)

  if (visits === null) return null
  const next = upcomingVisits(visits, todayDateValue())[0]
  if (next) return <Navigate to={`/account/pediatrician/visits/${next.id}`} replace />
  return <Navigate to="/account/pediatrician/history" replace />
}
