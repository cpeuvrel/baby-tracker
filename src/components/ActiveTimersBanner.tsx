import { useNavigate } from 'react-router-dom'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveSleepEntry } from '../hooks/useActiveSleepEntry'
import { useElapsedSeconds } from '../hooks/useElapsedSeconds'
import { useSleepTimerNotification } from '../hooks/useSleepTimerNotification'
import { formatElapsed } from '../lib/duration'
import { SLEEP_TIMER_URL } from '../lib/sleepTimerNotification'
import { stopSleep } from '../repositories/sleepEntries'

export function ActiveTimersBanner() {
  const { household, selectedBaby } = useHousehold()
  const navigate = useNavigate()
  const sleepEntry = useActiveSleepEntry(household?.id ?? null, selectedBaby?.id ?? null)
  const sleepElapsed = useElapsedSeconds(sleepEntry?.startedAt ?? null)
  useSleepTimerNotification(selectedBaby?.name ?? null, sleepEntry)

  if (!household || !selectedBaby || !sleepEntry) return null

  return (
    <div role="status" aria-live="polite">
      <p>
        <button type="button" className="link-button" onClick={() => navigate(SLEEP_TIMER_URL)}>
          Sleep in progress for {formatElapsed(sleepElapsed)}
        </button>{' '}
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
