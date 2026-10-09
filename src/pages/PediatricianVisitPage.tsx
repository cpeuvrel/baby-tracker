import { useEffect } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { BlobIcon } from '../components/BlobIcon'
import { ChatIcon, NotebookIcon, SyringeIcon } from '../components/icons'
import { NewVisitButton } from '../components/NewVisitButton'
import { useAuth } from '../contexts/AuthContext'
import { useCurrentVisit } from '../hooks/useCurrentVisit'
import { registerPush } from '../lib/pushRegistration'
import { requestSleepTimerNotificationPermission } from '../lib/sleepTimerNotification'
import { VACCINE_BOUGHT_PARAM } from '../lib/vaccineNotification'
import { formatVisitDate } from '../lib/visitDate'
import { deletePediatricianVisit, updatePediatricianVisit } from '../repositories/pediatricianVisits'

export function PediatricianVisitPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { household, baby, visit } = useCurrentVisit()
  const [searchParams] = useSearchParams()
  const boughtFromNotification = searchParams.get(VACCINE_BOUGHT_PARAM) != null

  // "Yes" on the notification asking whether the vaccine was bought: record it
  // and drop the notification's params from the address.
  useEffect(() => {
    if (!boughtFromNotification || !household || !baby || !visit) return
    if (!visit.vaccineBought) void updatePediatricianVisit(household.id, baby.id, visit.id, { vaccineBought: true })
    navigate(`/account/pediatrician/visits/${visit.id}`, { replace: true })
  }, [boughtFromNotification, household, baby, visit, navigate])

  if (visit === null) return <Navigate to="/account/pediatrician" replace />
  if (!household || !baby || !visit) return null

  const setVaccinated = (vaccinated: boolean) => {
    if (vaccinated === visit.vaccinated) return
    void updatePediatricianVisit(household.id, baby.id, visit.id, { vaccinated })
    // The vaccine reminders come as notifications; this tap is the gesture asking needs.
    if (vaccinated && user) {
      void requestSleepTimerNotificationPermission()
        .then(() => registerPush(user.uid))
        .catch(() => {})
    }
  }

  const setVaccineBought = (vaccineBought: boolean) => {
    if (vaccineBought === visit.vaccineBought) return
    void updatePediatricianVisit(household.id, baby.id, visit.id, { vaccineBought })
  }

  const setDate = (date: string) => {
    if (date === '' || date === visit.date) return
    void updatePediatricianVisit(household.id, baby.id, visit.id, { date })
  }

  const handleDelete = () => {
    if (!window.confirm('Delete this visit, with its remarks and discussion?')) return
    void deletePediatricianVisit(household.id, baby.id, visit.id).then(() =>
      navigate('/account/pediatrician/history', { replace: true }),
    )
  }

  const base = `/account/pediatrician/visits/${visit.id}`

  return (
    <div>
      <div className="detail-header">
        <Link to="/account/pediatrician/history" aria-label="Back">
          ‹
        </Link>
        <h2>{formatVisitDate(visit.date)}</h2>
      </div>

      <div>
        <label htmlFor="visit-date">Date</label>
        <input
          id="visit-date"
          type="date"
          required
          value={visit.date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>
      <span className="field-label field-label-with-icon">
        <SyringeIcon />
        Vaccine
      </span>
      <div role="group" aria-label="Vaccine" className="segmented-control">
        <button type="button" aria-pressed={visit.vaccinated} onClick={() => setVaccinated(true)}>
          Yes
        </button>
        <button type="button" aria-pressed={!visit.vaccinated} onClick={() => setVaccinated(false)}>
          No
        </button>
      </div>
      {visit.vaccinated && (
        <>
          <span className="field-label">Vaccine bought</span>
          <div role="group" aria-label="Vaccine bought" className="segmented-control">
            <button type="button" aria-pressed={visit.vaccineBought} onClick={() => setVaccineBought(true)}>
              Yes
            </button>
            <button type="button" aria-pressed={!visit.vaccineBought} onClick={() => setVaccineBought(false)}>
              No
            </button>
          </div>
          {!visit.vaccineBought && (
            <p className="hint">Reminder at noon from 4 days before the visit, until it's bought.</p>
          )}
        </>
      )}

      <ul className="list-group list-group-large">
        <li>
          <Link to={`${base}/remarks`}>
            <span className="list-row-label">
              <BlobIcon colorVar="--category-feeding" size="small">
                <NotebookIcon />
              </BlobIcon>
              <span>Remarks</span>
            </span>
            <span className="list-group-trailing">
              <span className="list-group-meta">{visit.remarks.length}</span>
              <span className="list-row-chevron" aria-hidden="true">
                ›
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link to={`${base}/discussion`}>
            <span className="list-row-label">
              <BlobIcon colorVar="--category-sleep" size="small">
                <ChatIcon />
              </BlobIcon>
              <span>Discussion</span>
            </span>
            <span className="list-group-trailing">
              <span className="list-group-meta">{visit.discussions.length}</span>
              <span className="list-row-chevron" aria-hidden="true">
                ›
              </span>
            </span>
          </Link>
        </li>
      </ul>

      <button type="button" className="button-delete" onClick={handleDelete}>
        Delete visit
      </button>
      <NewVisitButton />
    </div>
  )
}
