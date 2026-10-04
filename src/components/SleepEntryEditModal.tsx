import { useState, type FormEvent } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveSleepEntry } from '../hooks/useActiveSleepEntry'
import { useRecentSleepEntries } from '../hooks/useRecentSleepEntries'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/datetimeInput'
import { formatDuration } from '../lib/duration'
import { deleteSleepEntry, resumeSleep, updateSleepEntry } from '../repositories/sleepEntries'
import type { SleepEntry } from '../types/models'
import { DurationInput } from './DurationInput'
import { Modal } from './Modal'
import { DateTimeField } from './DateTimeField'

interface SleepEntryEditModalProps {
  entry: SleepEntry
  onClose: () => void
  /** Called instead of onClose once Start resumed the sleep, e.g. to show the running timer. */
  onResumed?: () => void
}

export function SleepEntryEditModal({ entry, onClose, onResumed }: SleepEntryEditModalProps) {
  const { household, selectedBaby } = useHousehold()
  const [startedAt, setStartedAt] = useState(() => toDatetimeLocalValue(new Date(entry.startedAt)))
  const [endedAt, setEndedAt] = useState(() =>
    entry.endedAt ? toDatetimeLocalValue(new Date(entry.endedAt)) : '',
  )
  const [notes, setNotes] = useState(entry.notes)
  const activeSleep = useActiveSleepEntry(household?.id ?? null, selectedBaby?.id ?? null)
  const [latestSleep] = useRecentSleepEntries(household?.id ?? null, selectedBaby?.id ?? null, 1)

  if (!household || !selectedBaby) return null

  // Start continues the latest sleep (stopped by mistake, or the baby fell back asleep), as long as
  // no other sleep is running; an older one would become an overlapping, back-dated timer.
  const canStart = entry.endedAt != null && activeSleep == null && latestSleep?.id === entry.id

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

  const handleStart = () => {
    void resumeSleep(household.id, selectedBaby.id, entry.id, fromDatetimeLocalValue(startedAt))
    if (onResumed) onResumed()
    else onClose()
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
        {canStart && (
          <button type="button" className="button-action button-start-again" onClick={handleStart}>
            Start Timer
          </button>
        )}
        <DurationInput totalMinutes={durationMinutes} onChange={handleDurationChange} />
        <DateTimeField id="sleep-started-at" label="Start Time" value={startedAt} onChange={setStartedAt} />
        <DateTimeField id="sleep-ended-at" label="End Time" value={endedAt} onChange={setEndedAt} />
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
