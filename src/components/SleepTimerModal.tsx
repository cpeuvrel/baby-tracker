import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveSleepEntry } from '../hooks/useActiveSleepEntry'
import { useElapsedSeconds } from '../hooks/useElapsedSeconds'
import { toDatetimeLocalValue } from '../lib/datetimeInput'
import { formatDuration } from '../lib/duration'
import { logSleep, startSleep, stopSleep } from '../repositories/sleepEntries'
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
  const [endedAt, setEndedAt] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (activeEntry) setPendingStart(false)
  }, [activeEntry])

  if (!household || !selectedBaby || !user) return null

  const isActive = activeEntry != null

  const handleToggleTimer = () => {
    if (activeEntry) {
      void stopSleep(household.id, selectedBaby.id, activeEntry.id, new Date(activeEntry.startedAt))
    } else if (!pendingStart) {
      setPendingStart(true)
      void startSleep(household.id, selectedBaby.id, user.uid, new Date(startedAt))
    }
  }

  const handleSave = () => {
    if (!isActive && endedAt !== '') {
      void logSleep(household.id, selectedBaby.id, user.uid, {
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt),
        notes,
      })
    }
    onClose()
  }

  const startTimeValue = activeEntry ? toDatetimeLocalValue(new Date(activeEntry.startedAt)) : startedAt
  const counter = isActive ? formatDuration(elapsedSeconds) : pendingStart ? 'Démarrage…' : '—'

  return (
    <Modal
      title="Sommeil"
      bandColorVar="--category-sleep"
      onClose={onClose}
      headerAction={{ label: 'Save', onClick: handleSave }}
    >
      <p className="modal-field-label">Total Time</p>
      <p className="modal-counter" aria-live="polite">
        {counter}
      </p>
      <button
        type="button"
        className="button-action"
        onClick={handleToggleTimer}
        disabled={pendingStart && !isActive}
      >
        {isActive ? 'Stop Timer' : 'Start Timer'}
      </button>
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
      <div>
        <label htmlFor="sleep-ended-at">End Time</label>
        <input
          id="sleep-ended-at"
          type="datetime-local"
          value={endedAt}
          disabled={isActive}
          onChange={(event) => setEndedAt(event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="sleep-notes">Notes (optionnel)</label>
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
