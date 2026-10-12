import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveSleepEntries } from '../hooks/useActiveSleepEntry'
import { useElapsedSeconds } from '../hooks/useElapsedSeconds'
import { useSleepTimerNotification } from '../hooks/useSleepTimerNotification'
import { formatElapsed } from '../lib/duration'
import { SLEEP_TIMER_URL } from '../lib/sleepTimerNotification'
import { stopSleep } from '../repositories/sleepEntries'

export function ActiveTimersBanner() {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const navigate = useNavigate()
  const sleepEntries = useActiveSleepEntries(household?.id ?? null, selectedBaby?.id ?? null)
  const sleepEntry = sleepEntries[0] ?? null
  const sleepElapsed = useElapsedSeconds(sleepEntry?.startedAt ?? null)
  useSleepTimerNotification(user?.uid ?? null, selectedBaby ?? null, sleepEntry)

  if (!household || !selectedBaby || !sleepEntry) return null

  return (
    <div role="status" aria-live="polite">
      <p>
        <button type="button" className="link-button" onClick={() => navigate(SLEEP_TIMER_URL)}>
          Sleep in progress for {formatElapsed(sleepElapsed)}
        </button>{' '}
        <button
          type="button"
          onClick={() => {
            for (const entry of sleepEntries) {
              void stopSleep(household.id, selectedBaby.id, entry.id, new Date(entry.startedAt))
            }
          }}
        >
          {sleepEntries.length > 1 ? 'Stop all' : 'Stop'}
        </button>
      </p>
      {sleepEntries.length > 1 && (
        <p>{sleepEntries.length} sleep timers were started at the same time: Stop all ends them.</p>
      )}
    </div>
  )
}
