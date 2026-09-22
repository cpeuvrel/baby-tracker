import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveSleepEntry } from '../hooks/useActiveSleepEntry'
import { useElapsedSeconds } from '../hooks/useElapsedSeconds'
import { formatDuration } from '../lib/duration'
import { startSleep, stopSleep } from '../repositories/sleepEntries'

export function SleepTimerCard() {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const activeEntry = useActiveSleepEntry(household?.id ?? null, selectedBaby?.id ?? null)
  const elapsedSeconds = useElapsedSeconds(activeEntry?.startedAt ?? null)

  if (!household || !selectedBaby || !user) return null

  const handleStart = () => {
    void startSleep(household.id, selectedBaby.id, user.uid)
  }

  const handleStop = () => {
    if (!activeEntry) return
    void stopSleep(household.id, selectedBaby.id, activeEntry.id, new Date(activeEntry.startedAt))
  }

  return (
    <section aria-label="Sommeil">
      <h2>Sommeil</h2>
      {activeEntry ? (
        <>
          <p aria-live="polite">En cours depuis {formatDuration(elapsedSeconds)}</p>
          <button type="button" onClick={handleStop}>
            Arrêter le sommeil
          </button>
        </>
      ) : (
        <button type="button" onClick={handleStart}>
          Démarrer le sommeil
        </button>
      )}
    </section>
  )
}
