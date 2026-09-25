import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChildPhotoEditor } from '../components/ChildPhotoEditor'
import { ExportImportSection } from '../components/ExportImportSection'
import { useHousehold } from '../contexts/HouseholdContext'
import { DEFAULT_NIGHTTIME_HOURS } from '../lib/aggregations'
import { formatAge } from '../lib/age'
import { updateBaby } from '../repositories/babies'
import type { BabySex } from '../types/models'

export function ChildPage() {
  const { babyId } = useParams<{ babyId: string }>()
  const navigate = useNavigate()
  const { household, babies } = useHousehold()
  const baby = babies.find((candidate) => candidate.id === babyId)

  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState<BabySex | null>(null)

  useEffect(() => {
    if (baby) {
      setName(baby.name)
      setBirthDate(baby.birthDate)
      setSex(baby.sex)
    }
  }, [baby])

  if (!household || !baby) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim() === '' || birthDate.trim() === '') return
    void updateBaby(household.id, baby.id, name.trim(), birthDate, sex)
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="detail-header">
          <button type="button" aria-label="Back" onClick={() => navigate('/account/family')}>
            ‹
          </button>
          <h2>Child</h2>
          <button type="submit" className="modal-header-action">
            Save
          </button>
        </div>

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
          <ChildPhotoEditor householdId={household.id} baby={baby} />
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
            <dd>{formatAge(birthDate || baby.birthDate, new Date())}</dd>
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

      <ExportImportSection householdId={household.id} baby={baby} />
    </div>
  )
}
