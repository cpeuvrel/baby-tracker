import { useState, type FormEvent } from 'react'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveSleepEntry } from '../hooks/useActiveSleepEntry'
import { useNow } from '../hooks/useNow'
import { useRecentSleepEntries } from '../hooks/useRecentSleepEntries'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/datetimeInput'
import { formatDuration } from '../lib/duration'
import { reportWriteError } from '../lib/reportWriteError'
import { alertSleepWriteFailed } from '../lib/sleepAlreadyRunning'
import { deleteSleepEntry, resumeSleep, updateSleepEntry } from '../repositories/sleepEntries'
import type { SleepEntry } from '../types/models'
import { DurationInput } from './DurationInput'
import { Modal } from './Modal'
import { DateTimeField } from './DateTimeField'

/** A stopped sleep can only be continued within this long after it ended. */
const RESUME_WINDOW_MS = 60 * 60 * 1000
const FORM_ID = 'sleep-edit-form'

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
  const [resuming, setResuming] = useState(false)
  const activeSleep = useActiveSleepEntry(household?.id ?? null, selectedBaby?.id ?? null)
  const [latestSleep] = useRecentSleepEntries(household?.id ?? null, selectedBaby?.id ?? null, 1)
  const now = useNow()

  if (!household || !selectedBaby) return null

  // Start continues the latest sleep (stopped by mistake, or the baby fell back asleep) if it ended
  // less than an hour ago and no other sleep is running; an older one would become an
  // overlapping, back-dated timer.
  const canStart =
    entry.endedAt != null &&
    now.getTime() - new Date(entry.endedAt).getTime() < RESUME_WINDOW_MS &&
    activeSleep == null &&
    latestSleep?.id === entry.id

  const durationMinutes =
    endedAt !== '' && startedAt !== ''
      ? Math.round((fromDatetimeLocalValue(endedAt).getTime() - fromDatetimeLocalValue(startedAt).getTime()) / 60000)
      : null

  // Without an end the sleep would run again: only allowed where Start Timer is (canStart).
  const error = !startedAt
    ? 'Set a start time.'
    : durationMinutes != null && durationMinutes < 0
      ? 'End time must be after start time.'
      : endedAt === '' && !canStart
        ? 'Set an end time to save this sleep.'
        : null

  const handleDurationChange = (minutes: number | null) => {
    if (minutes == null) {
      setEndedAt('')
      return
    }
    if (!startedAt) return
    setEndedAt(toDatetimeLocalValue(new Date(fromDatetimeLocalValue(startedAt).getTime() + minutes * 60000)))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (error) return
    // Without an end time the sleep runs again: refused if another one runs.
    const lockInvolved = endedAt === ''
    updateSleepEntry(household.id, selectedBaby.id, entry.id, {
      startedAt: fromDatetimeLocalValue(startedAt),
      endedAt: endedAt !== '' ? fromDatetimeLocalValue(endedAt) : null,
      notes,
    }).catch((writeError: unknown) => alertSleepWriteFailed(writeError, lockInvolved))
    onClose()
  }

  const handleStart = () => {
    if (!startedAt) return
    setResuming(true)
    // The running timer shows only once the resume is accepted: refused if another sleep runs.
    resumeSleep(household.id, selectedBaby.id, entry.id, fromDatetimeLocalValue(startedAt), notes)
      .then(() => (onResumed ? onResumed() : onClose()))
      .catch((writeError: unknown) => {
        setResuming(false)
        alertSleepWriteFailed(writeError, true)
      })
  }

  const handleDelete = () => {
    if (!window.confirm('Delete this entry?')) return
    deleteSleepEntry(household.id, selectedBaby.id, entry.id).catch(reportWriteError('delete the sleep'))
    onClose()
  }

  return (
    <Modal
      title="Sleep"
      bandColorVar="--category-sleep"
      onClose={onClose}
      headerAction={{ label: 'Save', formId: FORM_ID, disabled: error != null }}
    >
      <form id={FORM_ID} onSubmit={handleSubmit}>
        <p className="modal-field-label">Total Time</p>
        <p className="modal-counter">
          {durationMinutes != null && durationMinutes >= 0 ? formatDuration(durationMinutes * 60) : '—'}
        </p>
        {canStart && (
          <button
            type="button"
            className="button-action button-timer-start button-start-again"
            onClick={handleStart}
            disabled={resuming}
          >
            Start Timer
          </button>
        )}
        <DurationInput totalMinutes={durationMinutes} onChange={handleDurationChange} />
        <DateTimeField id="sleep-started-at" label="Start Time" value={startedAt} onChange={setStartedAt} />
        <DateTimeField id="sleep-ended-at" label="End Time" value={endedAt} onChange={setEndedAt} />
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
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
