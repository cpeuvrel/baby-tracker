import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveBottleFeeding } from '../hooks/useActiveBottleFeeding'
import { useActiveSleepEntry } from '../hooks/useActiveSleepEntry'
import { useElapsedSeconds } from '../hooks/useElapsedSeconds'
import { formatDuration } from '../lib/duration'
import { stopBottleFeeding } from '../repositories/feedingEntries'
import { stopSleep } from '../repositories/sleepEntries'

export function ActiveTimersBanner() {
  const { household, selectedBaby } = useHousehold()
  const sleepEntry = useActiveSleepEntry(household?.id ?? null, selectedBaby?.id ?? null)
  const feedingEntry = useActiveBottleFeeding(household?.id ?? null, selectedBaby?.id ?? null)
  const sleepElapsed = useElapsedSeconds(sleepEntry?.startedAt ?? null)
  const feedingElapsed = useElapsedSeconds(feedingEntry?.startedAt ?? null)

  if (!household || !selectedBaby || (!sleepEntry && !feedingEntry)) return null

  return (
    <div role="status" aria-live="polite">
      {sleepEntry && (
        <p>
          Sommeil en cours depuis {formatDuration(sleepElapsed)}{' '}
          <button
            type="button"
            onClick={() =>
              void stopSleep(household.id, selectedBaby.id, sleepEntry.id, new Date(sleepEntry.startedAt))
            }
          >
            Arrêter
          </button>
        </p>
      )}
      {feedingEntry && (
        <p>
          Biberon en cours depuis {formatDuration(feedingElapsed)}{' '}
          <button
            type="button"
            onClick={() =>
              void stopBottleFeeding(
                household.id,
                selectedBaby.id,
                feedingEntry.id,
                new Date(feedingEntry.startedAt),
                null,
              )
            }
          >
            Arrêter
          </button>
        </p>
      )}
    </div>
  )
}
