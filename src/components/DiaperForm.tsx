import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/datetimeInput'
import { reportWriteError } from '../lib/reportWriteError'
import { deleteDiaperEntry, logDiaper, updateDiaperEntry } from '../repositories/diaperEntries'
import type { DiaperEntry, DiaperType } from '../types/models'
import { Modal } from './Modal'
import { DateTimeField } from './DateTimeField'

const DIAPER_TYPES: { value: DiaperType; label: string }[] = [
  { value: 'wet', label: 'Wet' },
  { value: 'dirty', label: 'Dirty' },
  { value: 'both', label: 'Both' },
  { value: 'dry', label: 'Dry' },
]

const FORM_ID = 'diaper-form'

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
    if (!occurredAt) return
    logDiaper(household.id, selectedBaby.id, user.uid, {
      type: loggedType,
      occurredAt: fromDatetimeLocalValue(occurredAt),
      notes,
    }).catch(reportWriteError('save the diaper change'))
    setNotes('')
    onClose()
  }

  const submit = () => {
    if (!entry || !occurredAt) return
    updateDiaperEntry(household.id, selectedBaby.id, entry.id, {
      type,
      occurredAt: fromDatetimeLocalValue(occurredAt),
      notes,
    }).catch(reportWriteError('save the diaper change'))
    onClose()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  const handleDelete = () => {
    if (!entry) return
    if (!window.confirm('Delete this entry?')) return
    deleteDiaperEntry(household.id, selectedBaby.id, entry.id).catch(reportWriteError('delete the diaper change'))
    onClose()
  }

  return (
    <Modal
      title="Diaper"
      bandColorVar="--category-diaper"
      onClose={onClose}
      headerAction={entry ? { label: 'Save', formId: FORM_ID } : undefined}
    >
      <form id={FORM_ID} onSubmit={handleSubmit}>
        <DateTimeField id="diaper-occurred-at" label="Time" value={occurredAt} onChange={setOccurredAt} />
        {!occurredAt && (
          <p role="alert" className="form-error">
            Pick a date.
          </p>
        )}
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
