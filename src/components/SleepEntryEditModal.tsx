import { useState, type FormEvent } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveSleepEntry } from '../hooks/useActiveSleepEntry'
import { useRecentSleepEntries } from '../hooks/useRecentSleepEntries'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/datetimeInput'
import { formatDuration } from '../lib/duration'
import { withDuration, withEnd, withStart, type SleepTimes } from '../lib/sleepTimes'
import { deleteSleepEntry, resumeSleep, updateSleepEntry } from '../repositories/sleepEntries'
import type { SleepEntry } from '../types/models'
import { DurationInput } from './DurationInput'
import { Modal } from './Modal'
import { DateTimeField } from './DateTimeField'

/** A stopped sleep can only be continued within this long after it ended. */
const RESUME_WINDOW_MS = 60 * 60 * 1000

interface SleepEntryEditModalProps {
  entry: SleepEntry
  onClose: () => void
  /** Called instead of onClose once Start resumed the sleep, e.g. to show the running timer. */
  onResumed?: () => void
}

export function SleepEntryEditModal({ entry, onClose, onResumed }: SleepEntryEditModalProps) {
  const { household, selectedBaby } = useHousehold()
  const [times, setTimes] = useState<SleepTimes>(() =>
    withEnd(
      { start: toDatetimeLocalValue(new Date(entry.startedAt)), end: '', duration: null },
      entry.endedAt ? toDatetimeLocalValue(new Date(entry.endedAt)) : '',
    ),
  )
  const { start: startedAt, end: endedAt, duration: durationMinutes } = times
  const [notes, setNotes] = useState(entry.notes)
  const activeSleep = useActiveSleepEntry(household?.id ?? null, selectedBaby?.id ?? null)
  const [latestSleep] = useRecentSleepEntries(household?.id ?? null, selectedBaby?.id ?? null, 1)

  if (!household || !selectedBaby) return null

  // Start continues the latest sleep (stopped by mistake, or the baby fell back asleep) if it ended
  // less than an hour ago and no other sleep is running; an older one would become an
  // overlapping, back-dated timer.
  const canStart =
    entry.endedAt != null &&
    Date.now() - new Date(entry.endedAt).getTime() < RESUME_WINDOW_MS &&
    activeSleep == null &&
    latestSleep?.id === entry.id

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
        <DurationInput totalMinutes={durationMinutes} onChange={(minutes) => setTimes(withDuration(times, minutes))} />
        <DateTimeField id="sleep-started-at" label="Start Time" value={startedAt} onChange={(value) => setTimes(withStart(times, value))} />
        <DateTimeField id="sleep-ended-at" label="End Time" value={endedAt} onChange={(value) => setTimes(withEnd(times, value))} />
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
