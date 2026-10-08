import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { NewVisitModal } from '../components/NewVisitModal'
import { useHousehold } from '../contexts/HouseholdContext'
import { usePediatricianVisits } from '../hooks/usePediatricianVisits'

export function PediatricianPage() {
  const navigate = useNavigate()
  const { household, selectedBaby } = useHousehold()
  const visits = usePediatricianVisits(household?.id ?? null, selectedBaby?.id ?? null)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <div className="detail-header">
        <Link to="/account" aria-label="Back">
          ‹
        </Link>
        <h2>Pediatrician</h2>
      </div>

      {selectedBaby ? (
        <>
          <p className="hint">Visits for {selectedBaby.name}</p>
          <ul className="list-group">
            <li>
              <button type="button" className="list-row-button" onClick={() => setCreating(true)}>
                <span>New Visit</span>
                <span className="list-row-chevron" aria-hidden="true">
                  +
                </span>
              </button>
            </li>
            <li>
              <Link to="/account/pediatrician/history">
                <span>History</span>
                <span className="list-group-trailing">
                  {visits && <span className="list-group-meta">{visits.length}</span>}
                  <span className="list-row-chevron" aria-hidden="true">
                    ›
                  </span>
                </span>
              </Link>
            </li>
          </ul>
        </>
      ) : (
        <p className="hint">Add a child first.</p>
      )}

      {creating && (
        <NewVisitModal
          onClose={() => setCreating(false)}
          onCreated={(visitId) => navigate(`/account/pediatrician/visits/${visitId}`)}
        />
      )}
    </div>
  )
}
