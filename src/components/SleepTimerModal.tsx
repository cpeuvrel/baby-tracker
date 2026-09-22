import { useState, type FormEvent } from 'react'
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
  const [starting, setStarting] = useState(false)
  const [startedAt, setStartedAt] = useState(() => toDatetimeLocalValue(new Date()))
  const [endedAt, setEndedAt] = useState('')
  const [notes, setNotes] = useState('')

  if (!household || !selectedBaby || !user) return null

  const handleStart = () => {
    setStarting(true)
    void startSleep(household.id, selectedBaby.id, user.uid, new Date(startedAt))
  }

  const handleStopAndSave = () => {
    if (!activeEntry) return
    void stopSleep(household.id, selectedBaby.id, activeEntry.id, new Date(activeEntry.startedAt))
    onClose()
  }

  const handleSaveFixedEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (endedAt === '') return
    void logSleep(household.id, selectedBaby.id, user.uid, {
      startedAt: new Date(startedAt),
      endedAt: new Date(endedAt),
      notes,
    })
    onClose()
  }

  if (activeEntry || starting) {
    const startTimeLabel = activeEntry
      ? new Date(activeEntry.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '—'

    return (
      <Modal title="Sommeil" bandColorVar="--category-sleep" onClose={onClose}>
        <p className="modal-field-label">Total Time</p>
        <p className="modal-counter" aria-live="polite">
          {activeEntry ? formatDuration(elapsedSeconds) : 'Démarrage…'}
        </p>
        <dl className="modal-fields">
          <div>
            <dt>Start Time</dt>
            <dd>{startTimeLabel}</dd>
          </div>
          <div>
            <dt>End Time</dt>
            <dd>Add</dd>
          </div>
        </dl>
        <button
          type="button"
          className="button-action"
          onClick={handleStopAndSave}
          disabled={!activeEntry}
        >
          Enregistrer
        </button>
      </Modal>
    )
  }

  return (
    <Modal title="Sommeil" bandColorVar="--category-sleep" onClose={onClose}>
      <form onSubmit={handleSaveFixedEntry}>
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
          <label htmlFor="sleep-notes">Notes (optionnel)</label>
          <input
            id="sleep-notes"
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        <button type="button" className="button-action" onClick={handleStart}>
          Start
        </button>
        <button type="submit" disabled={endedAt === ''}>
          Enregistrer
        </button>
      </form>
    </Modal>
  )
}
