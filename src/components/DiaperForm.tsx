import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { toDatetimeLocalValue } from '../lib/datetimeInput'
import { deleteDiaperEntry, logDiaper, updateDiaperEntry } from '../repositories/diaperEntries'
import type { DiaperEntry, DiaperType } from '../types/models'

const DIAPER_TYPES: { value: DiaperType; label: string }[] = [
  { value: 'wet', label: 'Wet' },
  { value: 'dirty', label: 'Dirty' },
  { value: 'both', label: 'Both' },
  { value: 'dry', label: 'Dry' },
]

interface DiaperFormProps {
  entry?: DiaperEntry
  onSaved: () => void
}

export function DiaperForm({ entry, onSaved }: DiaperFormProps) {
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
      occurredAt: new Date(occurredAt),
      notes,
    })
    setNotes('')
    onSaved()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!entry) return
    void updateDiaperEntry(household.id, selectedBaby.id, entry.id, {
      type,
      occurredAt: new Date(occurredAt),
      notes,
    })
    onSaved()
  }

  const handleDelete = () => {
    if (!entry) return
    if (!window.confirm('Supprimer cette entrée ?')) return
    void deleteDiaperEntry(household.id, selectedBaby.id, entry.id)
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="diaper-occurred-at">Heure</label>
        <input
          id="diaper-occurred-at"
          type="datetime-local"
          value={occurredAt}
          onChange={(event) => setOccurredAt(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="diaper-notes">Notes (optionnel)</label>
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
          <button type="submit">Enregistrer</button>
          <button type="button" className="button-delete" onClick={handleDelete}>
            Supprimer
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
  )
}
