import { useState, type FormEvent } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/datetimeInput'
import { formatDuration } from '../lib/duration'
import { deleteSleepEntry, updateSleepEntry } from '../repositories/sleepEntries'
import type { SleepEntry } from '../types/models'
import { DurationInput } from './DurationInput'
import { Modal } from './Modal'

interface SleepEntryEditModalProps {
  entry: SleepEntry
  onClose: () => void
}

export function SleepEntryEditModal({ entry, onClose }: SleepEntryEditModalProps) {
  const { household, selectedBaby } = useHousehold()
  const [startedAt, setStartedAt] = useState(() => toDatetimeLocalValue(new Date(entry.startedAt)))
  const [endedAt, setEndedAt] = useState(() =>
    entry.endedAt ? toDatetimeLocalValue(new Date(entry.endedAt)) : '',
  )
  const [notes, setNotes] = useState(entry.notes)

  if (!household || !selectedBaby) return null

  const durationMinutes =
    endedAt !== ''
      ? Math.round((fromDatetimeLocalValue(endedAt).getTime() - fromDatetimeLocalValue(startedAt).getTime()) / 60000)
      : null

  const handleDurationChange = (minutes: number | null) => {
    if (minutes == null) {
      setEndedAt('')
      return
    }
    setEndedAt(toDatetimeLocalValue(new Date(fromDatetimeLocalValue(startedAt).getTime() + minutes * 60000)))
  }

  const submit = () => {
    void updateSleepEntry(household.id, selectedBaby.id, entry.id, {
      startedAt: fromDatetimeLocalValue(startedAt),
      endedAt: endedAt !== '' ? fromDatetimeLocalValue(endedAt) : null,
      notes,
    })
    onClose()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  const handleDelete = () => {
    if (!window.confirm('Delete this entry?')) return
    void deleteSleepEntry(household.id, selectedBaby.id, entry.id)
    onClose()
  }

  return (
    <Modal
      title="Sleep"
      bandColorVar="--category-sleep"
      onClose={onClose}
      headerAction={{ label: 'Save', onClick: submit }}
    >
      <form onSubmit={handleSubmit}>
        <p className="modal-field-label">Total Time</p>
        <p className="modal-counter">
          {durationMinutes != null ? formatDuration(durationMinutes * 60) : '—'}
        </p>
        <DurationInput totalMinutes={durationMinutes} onChange={handleDurationChange} />
        <div>
          <label htmlFor="sleep-started-at">Start Time</label>
          <input
            id="sleep-started-at"
            type="datetime-local"
            value={startedAt}
            onChange={(event) => setStartedAt(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="sleep-ended-at">End Time</label>
          <input
            id="sleep-ended-at"
            type="datetime-local"
            value={endedAt}
            onChange={(event) => setEndedAt(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="sleep-notes">Notes (optional)</label>
          <input
            id="sleep-notes"
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        <button type="button" className="button-delete" onClick={handleDelete}>
          Delete
        </button>
      </form>
    </Modal>
  )
}
