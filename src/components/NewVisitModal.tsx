import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { todayDateValue } from '../lib/visitDate'
import { addPediatricianVisit } from '../repositories/pediatricianVisits'
import { Modal } from './Modal'

interface NewVisitModalProps {
  onClose: () => void
  onCreated: (visitId: string) => void
}

export function NewVisitModal({ onClose, onCreated }: NewVisitModalProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const [date, setDate] = useState(todayDateValue)
  const [vaccinated, setVaccinated] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!user || !household || !selectedBaby) return null

  const submit = () => {
    if (date === '' || saving) return
    setSaving(true)
    void addPediatricianVisit(household.id, selectedBaby.id, user.uid, { date, vaccinated })
      .then(onCreated)
      .catch((error: unknown) => {
        console.error('[pediatrician] visit creation failed', error)
        setSaving(false)
      })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  return (
    <Modal
      title="New Visit"
      bandColorVar="--category-medication"
      onClose={onClose}
      headerAction={{ label: 'Create', onClick: submit, disabled: date === '' || saving }}
    >
      <form onSubmit={handleSubmit}>
        <p className="hint">For {selectedBaby.name}</p>
        <div>
          <label htmlFor="visit-date">Date</label>
          <input
            id="visit-date"
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <span className="field-label">Vaccine</span>
        <div role="group" aria-label="Vaccine" className="segmented-control">
          <button type="button" aria-pressed={vaccinated} onClick={() => setVaccinated(true)}>
            Yes
          </button>
          <button type="button" aria-pressed={!vaccinated} onClick={() => setVaccinated(false)}>
            No
          </button>
        </div>
      </form>
    </Modal>
  )
}
