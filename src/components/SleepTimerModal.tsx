import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveSleepEntry } from '../hooks/useActiveSleepEntry'
import { useElapsedSeconds } from '../hooks/useElapsedSeconds'
import { toDatetimeLocalValue } from '../lib/datetimeInput'
import { formatDuration } from '../lib/duration'
import { logSleep, startSleep, stopSleep, updateSleepEntry } from '../repositories/sleepEntries'
import { DurationInput } from './DurationInput'
import { Modal } from './Modal'

interface SleepTimerModalProps {
  onClose: () => void
}

export function SleepTimerModal({ onClose }: SleepTimerModalProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const activeEntry = useActiveSleepEntry(household?.id ?? null, selectedBaby?.id ?? null)
  const elapsedSeconds = useElapsedSeconds(activeEntry?.startedAt ?? null)
  const [pendingStart, setPendingStart] = useState(false)
  const [startedAt, setStartedAt] = useState(() => toDatetimeLocalValue(new Date()))
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [timerEntryId, setTimerEntryId] = useState<string | null>(null)

  useEffect(() => {
    if (activeEntry) setPendingStart(false)
  }, [activeEntry])

  if (!household || !selectedBaby || !user) return null

  const isActive = activeEntry != null

  const endedAt =
    durationMinutes != null
      ? toDatetimeLocalValue(new Date(new Date(startedAt).getTime() + durationMinutes * 60000))
      : ''

  const handleToggleTimer = () => {
    if (activeEntry) {
      const stoppedAt = new Date()
      const startDate = new Date(activeEntry.startedAt)
      void stopSleep(household.id, selectedBaby.id, activeEntry.id, startDate)
      setStartedAt(toDatetimeLocalValue(startDate))
      setDurationMinutes(Math.round((stoppedAt.getTime() - startDate.getTime()) / 60000))
      setTimerEntryId(activeEntry.id)
    } else if (!pendingStart) {
      setPendingStart(true)
      void startSleep(household.id, selectedBaby.id, user.uid, new Date(startedAt))
    }
  }

  const handleSave = () => {
    if (timerEntryId) {
      if (!isActive) {
        void updateSleepEntry(household.id, selectedBaby.id, timerEntryId, {
          startedAt: new Date(startedAt),
          endedAt: endedAt !== '' ? new Date(endedAt) : null,
          notes,
        })
      }
    } else if (!isActive && endedAt !== '') {
      void logSleep(household.id, selectedBaby.id, user.uid, {
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt),
        notes,
      })
    }
    onClose()
  }

  const handleEndedAtChange = (value: string) => {
    if (value === '') {
      setDurationMinutes(null)
      return
    }
    setDurationMinutes(Math.round((new Date(value).getTime() - new Date(startedAt).getTime()) / 60000))
  }

  const startTimeValue = activeEntry ? toDatetimeLocalValue(new Date(activeEntry.startedAt)) : startedAt
  const counter = isActive
    ? formatDuration(elapsedSeconds)
    : pendingStart
      ? 'Starting…'
      : durationMinutes != null
        ? formatDuration(durationMinutes * 60)
        : '—'

  return (
    <Modal
      title="Sleep"
      bandColorVar="--category-sleep"
      onClose={onClose}
      headerAction={{ label: 'Save', onClick: handleSave }}
    >
      <p className="modal-field-label">Total Time</p>
      <p className="modal-counter" aria-live="polite">
        {counter}
      </p>
      {timerEntryId == null && (
        <button
          type="button"
          className="button-action"
          onClick={handleToggleTimer}
          disabled={pendingStart && !isActive}
        >
          {isActive ? 'Stop Timer' : 'Start Timer'}
        </button>
      )}
      <div>
        <label htmlFor="sleep-started-at">Start Time</label>
        <input
          id="sleep-started-at"
          type="datetime-local"
          value={startTimeValue}
          disabled={isActive}
          onChange={(event) => setStartedAt(event.target.value)}
        />
      </div>
      <DurationInput totalMinutes={durationMinutes} onChange={setDurationMinutes} disabled={isActive} />
      <div>
        <label htmlFor="sleep-ended-at">End Time</label>
        <input
          id="sleep-ended-at"
          type="datetime-local"
          value={endedAt}
          disabled={isActive}
          onChange={(event) => handleEndedAtChange(event.target.value)}
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
    </Modal>
  )
}
