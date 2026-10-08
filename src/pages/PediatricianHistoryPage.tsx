import { Link } from 'react-router-dom'
import { useHousehold } from '../contexts/HouseholdContext'
import { usePediatricianVisits } from '../hooks/usePediatricianVisits'
import { formatVisitDate, todayDateValue } from '../lib/visitDate'
import type { PediatricianVisit } from '../types/models'

function VisitList({ label, visits }: { label: string; visits: PediatricianVisit[] }) {
  return (
    <section aria-label={label}>
      <h2>{label}</h2>
      <ul className="list-group">
        {visits.map((visit) => (
          <li key={visit.id}>
            <Link to={`/account/pediatrician/visits/${visit.id}`}>
              <span>{formatVisitDate(visit.date)}</span>
              <span className="list-group-trailing">
                {visit.vaccinated && <span className="list-group-meta">Vaccine</span>}
                <span className="list-row-chevron" aria-hidden="true">
                  ›
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function PediatricianHistoryPage() {
  const { household, selectedBaby } = useHousehold()
  const visits = usePediatricianVisits(household?.id ?? null, selectedBaby?.id ?? null)
  const today = todayDateValue()
  // Visits come most recent first: upcoming ones are listed soonest first.
  const upcoming = (visits ?? []).filter((visit) => visit.date > today).reverse()
  const past = (visits ?? []).filter((visit) => visit.date <= today)

  return (
    <div>
      <div className="detail-header">
        <Link to="/account/pediatrician" aria-label="Back">
          ‹
        </Link>
        <h2>History</h2>
      </div>

      {visits && visits.length === 0 && <p className="hint">No visits yet.</p>}
      {upcoming.length > 0 && <VisitList label="Upcoming" visits={upcoming} />}
      {past.length > 0 && <VisitList label="Past" visits={past} />}
    </div>
  )
}
