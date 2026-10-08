import { Link } from 'react-router-dom'
import { useHousehold } from '../contexts/HouseholdContext'
import { usePediatricianVisits } from '../hooks/usePediatricianVisits'
import { formatVisitDate } from '../lib/visitDate'

export function PediatricianHistoryPage() {
  const { household, selectedBaby } = useHousehold()
  const visits = usePediatricianVisits(household?.id ?? null, selectedBaby?.id ?? null)

  return (
    <div>
      <div className="detail-header">
        <Link to="/account/pediatrician" aria-label="Back">
          ‹
        </Link>
        <h2>History</h2>
      </div>

      {visits && visits.length === 0 && <p className="hint">No visits yet.</p>}
      {visits && visits.length > 0 && (
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
      )}
    </div>
  )
}
