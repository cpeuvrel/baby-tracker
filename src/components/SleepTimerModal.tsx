import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveSleepEntry } from '../hooks/useActiveSleepEntry'
import { useElapsedSeconds } from '../hooks/useElapsedSeconds'
import { formatDuration } from '../lib/duration'
import { stopSleep } from '../repositories/sleepEntries'
import { Modal } from './Modal'

interface SleepTimerModalProps {
  onClose: () => void
}

export function SleepTimerModal({ onClose }: SleepTimerModalProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const activeEntry = useActiveSleepEntry(household?.id ?? null, selectedBaby?.id ?? null)
  const elapsedSeconds = useElapsedSeconds(activeEntry?.startedAt ?? null)

  if (!household || !selectedBaby || !user) return null

  const handleStop = () => {
    if (!activeEntry) return
    void stopSleep(household.id, selectedBaby.id, activeEntry.id, new Date(activeEntry.startedAt))
    onClose()
  }

  const startTimeLabel = activeEntry
    ? new Date(activeEntry.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <Modal title="Sommeil" bandColorVar="--category-sleep" onClose={onClose}>
      <p className="modal-field-label">Total Time</p>
      <p className="modal-counter" aria-live="polite">
        {activeEntry ? formatDuration(elapsedSeconds) : 'Démarrage…'}
      </p>
      <button
        type="button"
        className="button-action"
        onClick={handleStop}
        disabled={!activeEntry}
      >
        Stop Timer
      </button>
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
    </Modal>
  )
}
