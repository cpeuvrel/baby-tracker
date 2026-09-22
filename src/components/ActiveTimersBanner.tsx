import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveSleepEntry } from '../hooks/useActiveSleepEntry'
import { useElapsedSeconds } from '../hooks/useElapsedSeconds'
import { formatDuration } from '../lib/duration'
import { stopSleep } from '../repositories/sleepEntries'

export function ActiveTimersBanner() {
  const { household, selectedBaby } = useHousehold()
  const sleepEntry = useActiveSleepEntry(household?.id ?? null, selectedBaby?.id ?? null)
  const sleepElapsed = useElapsedSeconds(sleepEntry?.startedAt ?? null)

  if (!household || !selectedBaby || !sleepEntry) return null

  return (
    <div role="status" aria-live="polite">
      <p>
        Sleep in progress for {formatDuration(sleepElapsed)}{' '}
        <button
          type="button"
          onClick={() =>
            void stopSleep(household.id, selectedBaby.id, sleepEntry.id, new Date(sleepEntry.startedAt))
          }
        >
          Stop
        </button>
      </p>
    </div>
  )
}
