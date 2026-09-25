import { useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/datetimeInput'
import { deleteBathEntry, logBath, updateBathEntry } from '../repositories/bathEntries'
import type { BathEntry } from '../types/models'
import { DateTimeField } from './DateTimeField'
import { Modal } from './Modal'

interface BathFormProps {
  entry?: BathEntry
  onClose: () => void
}

export function BathForm({ entry, onClose }: BathFormProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const [occurredAt, setOccurredAt] = useState(() =>
    toDatetimeLocalValue(entry ? new Date(entry.occurredAt) : new Date()),
  )
  const [notes, setNotes] = useState(entry?.notes ?? '')

  if (!household || !selectedBaby || !user) return null

  const submit = () => {
    const input = { occurredAt: fromDatetimeLocalValue(occurredAt), notes }
    if (entry) {
      void updateBathEntry(household.id, selectedBaby.id, entry.id, input)
    } else {
      void logBath(household.id, selectedBaby.id, user.uid, input)
    }
    onClose()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  const handleDelete = () => {
    if (!entry) return
    if (!window.confirm('Delete this entry?')) return
    void deleteBathEntry(household.id, selectedBaby.id, entry.id)
    onClose()
  }

  return (
    <Modal
      title="Bath"
      bandColorVar="--category-routine"
      onClose={onClose}
      headerAction={{ label: 'Save', onClick: submit }}
    >
      <form onSubmit={handleSubmit}>
        <DateTimeField id="bath-occurred-at" label="Time" value={occurredAt} onChange={setOccurredAt} />
        <div>
          <label htmlFor="bath-notes">Notes (optional)</label>
          <input id="bath-notes" type="text" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        {entry && (
          <button type="button" className="button-delete" onClick={handleDelete}>
            Delete
          </button>
        )}
      </form>
    </Modal>
  )
}
