import { Link } from 'react-router-dom'
import { NewVisitButton } from '../components/NewVisitButton'
import { useHousehold } from '../contexts/HouseholdContext'
import { usePediatricianVisits } from '../hooks/usePediatricianVisits'
import { upcomingVisits } from '../lib/upcomingVisits'
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
  const upcoming = upcomingVisits(visits ?? [], today)
  const past = (visits ?? []).filter((visit) => visit.date < today)

  return (
    <div>
      <div className="detail-header">
        <Link to="/account" aria-label="Back">
          ‹
        </Link>
        <h2>Pediatrician</h2>
      </div>

      {!selectedBaby && <p className="hint">Add a child first.</p>}

      {visits && visits.length === 0 && <p className="hint">No visits yet.</p>}
      {upcoming.length > 0 && <VisitList label="Upcoming" visits={upcoming} />}
      {past.length > 0 && <VisitList label="Past" visits={past} />}
      {selectedBaby && <NewVisitButton />}
    </div>
  )
}
