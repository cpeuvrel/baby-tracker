import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChildPhotoEditor } from '../components/ChildPhotoEditor'
import { ExportImportSection } from '../components/ExportImportSection'
import { useHousehold } from '../contexts/HouseholdContext'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useNow } from '../hooks/useNow'
import { DEFAULT_NIGHTTIME_HOURS } from '../lib/aggregations'
import { formatAge } from '../lib/age'
import { deleteBabyWithData } from '../lib/babyExport'
import { updateBaby } from '../repositories/babies'
import type { Baby, BabySex } from '../types/models'

export function ChildPage() {
  const { babyId } = useParams<{ babyId: string }>()
  const { household, babies } = useHousehold()
  const baby = babies.find((candidate) => candidate.id === babyId)

  if (!household) return null
  // Unknown child: a stale link, or deleted (from here or on the other phone). Without children
  // left, adding one is all the Family screens can offer.
  if (!baby) return <Navigate to={babies.length === 0 ? '/account/family/add' : '/account/family'} replace />

  // Keyed by child: the form starts from that child's profile, and a later snapshot (photo
  // saved, the other phone editing) leaves what is being typed alone.
  return <ChildProfile key={baby.id} householdId={household.id} baby={baby} lastChild={babies.length === 1} />
}

function ChildProfile({ householdId, baby, lastChild }: { householdId: string; baby: Baby; lastChild: boolean }) {
  const navigate = useNavigate()
  const now = useNow()
  const [name, setName] = useState(baby.name)
  const [birthDate, setBirthDate] = useState(baby.birthDate)
  const [sex, setSex] = useState<BabySex | null>(baby.sex)
  const save = useAsyncAction()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim() === '' || birthDate.trim() === '') return
    void save.run(async () => {
      await updateBaby(householdId, baby.id, name.trim(), birthDate, sex)
      navigate('/account/family')
    })
  }

  const handleDeleteChild = () => {
    if (
      !window.confirm(
        `Delete ${baby.name}? ${baby.name}'s profile and all of ${baby.name}'s data will be deleted. This cannot be undone.`,
      )
    )
      return
    setDeleting(true)
    setDeleteError(false)
    deleteBabyWithData(householdId, baby.id)
      .then(() => navigate(lastChild ? '/account/family/add' : '/account/family', { replace: true }))
      .catch((error: unknown) => {
        console.error('[child] delete failed', error)
        setDeleting(false)
        setDeleteError(true)
      })
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="detail-header">
          <button type="button" aria-label="Back" onClick={() => navigate('/account/family')}>
            ‹
          </button>
          <h2>Child</h2>
          <button type="submit" className="modal-header-action" disabled={save.pending}>
            Save
          </button>
        </div>
        {save.error && <p role="alert">{save.error}</p>}

        <div className="child-name-row">
          <div>
            <label htmlFor="child-name">First Name</label>
            <input
              id="child-name"
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <ChildPhotoEditor householdId={householdId} baby={baby} />
        </div>

        <div role="group" aria-label="Sex" className="segmented-control">
          <button type="button" aria-pressed={sex === 'male'} onClick={() => setSex('male')}>
            Boy
          </button>
          <button type="button" aria-pressed={sex === 'female'} onClick={() => setSex('female')}>
            Girl
          </button>
        </div>

        <div>
          <label htmlFor="child-birth-date">Birthdate</label>
          <input
            id="child-birth-date"
            type="date"
            required
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </div>

        <dl className="modal-fields">
          <div>
            <dt>Age</dt>
            <dd>{formatAge(birthDate || baby.birthDate, now)}</dd>
          </div>
        </dl>
      </form>

      <section aria-label="Settings">
        <h2>Settings</h2>
        <ul className="list-group">
          <li>
            <Link to={`/account/family/${baby.id}/activities`}>
              <span>Edit Activities</span>
              <span className="list-row-chevron" aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
          <li>
            <Link to={`/account/family/${baby.id}/nighttime-hours`}>
              <span>Nighttime Hours</span>
              <span className="list-group-trailing">
                <span className="list-group-meta">
                  {(baby.nighttimeHours ?? DEFAULT_NIGHTTIME_HOURS).start} -{' '}
                  {(baby.nighttimeHours ?? DEFAULT_NIGHTTIME_HOURS).end}
                </span>
                <span className="list-row-chevron" aria-hidden="true">
                  ›
                </span>
              </span>
            </Link>
          </li>
        </ul>
      </section>

      <ExportImportSection householdId={householdId} baby={baby} />

      <button
        type="button"
        className="settings-action settings-action-danger"
        onClick={handleDeleteChild}
        disabled={deleting}
      >
        Delete Child
      </button>
      {deleteError && <p role="alert">Could not delete {baby.name}.</p>}
    </div>
  )
}
