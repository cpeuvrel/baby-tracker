import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/datetimeInput'
import { deleteDiaperEntry, logDiaper, updateDiaperEntry } from '../repositories/diaperEntries'
import type { DiaperEntry, DiaperType } from '../types/models'
import { Modal } from './Modal'

const DIAPER_TYPES: { value: DiaperType; label: string }[] = [
  { value: 'wet', label: 'Wet' },
  { value: 'dirty', label: 'Dirty' },
  { value: 'both', label: 'Both' },
  { value: 'dry', label: 'Dry' },
]

interface DiaperFormProps {
  entry?: DiaperEntry
  onClose: () => void
}

export function DiaperForm({ entry, onClose }: DiaperFormProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const [occurredAt, setOccurredAt] = useState(() =>
    toDatetimeLocalValue(entry ? new Date(entry.occurredAt) : new Date()),
  )
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [type, setType] = useState<DiaperType>(entry?.type ?? 'wet')

  if (!household || !selectedBaby || !user) return null

  const handleLog = (loggedType: DiaperType) => {
    void logDiaper(household.id, selectedBaby.id, user.uid, {
      type: loggedType,
      occurredAt: fromDatetimeLocalValue(occurredAt),
      notes,
    })
    setNotes('')
    onClose()
  }

  const submit = () => {
    if (!entry) return
    void updateDiaperEntry(household.id, selectedBaby.id, entry.id, {
      type,
      occurredAt: fromDatetimeLocalValue(occurredAt),
      notes,
    })
    onClose()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  const handleDelete = () => {
    if (!entry) return
    if (!window.confirm('Delete this entry?')) return
    void deleteDiaperEntry(household.id, selectedBaby.id, entry.id)
    onClose()
  }

  return (
    <Modal
      title="Diaper"
      bandColorVar="--category-diaper"
      onClose={onClose}
      headerAction={entry ? { label: 'Save', onClick: submit } : undefined}
    >
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="diaper-occurred-at">Time</label>
          <input
            id="diaper-occurred-at"
            type="datetime-local"
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="diaper-notes">Notes (optional)</label>
          <input
            id="diaper-notes"
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        {entry ? (
          <>
            <div role="group" aria-label="Type">
              {DIAPER_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={type === value}
                  onClick={() => setType(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="button-delete" onClick={handleDelete}>
              Delete
            </button>
          </>
        ) : (
          <div>
            {DIAPER_TYPES.map(({ value, label }) => (
              <button key={value} type="button" onClick={() => handleLog(value)}>
                {label}
              </button>
            ))}
          </div>
        )}
      </form>
    </Modal>
  )
}
