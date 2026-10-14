import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveSleepEntriesState } from '../hooks/useActiveSleepEntry'
import { useElapsedSeconds } from '../hooks/useElapsedSeconds'
import { useSleepTimerNotification } from '../hooks/useSleepTimerNotification'
import { formatElapsed } from '../lib/duration'
import { alertSleepWriteFailed } from '../lib/sleepAlreadyRunning'
import { SLEEP_TIMER_URL } from '../lib/sleepTimerNotification'
import { stopSleep } from '../repositories/sleepEntries'

export function ActiveTimersBanner() {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const navigate = useNavigate()
  const { entries: sleepEntries, loading } = useActiveSleepEntriesState(
    household?.id ?? null,
    selectedBaby?.id ?? null,
  )
  const sleepEntry = sleepEntries[0] ?? null
  const sleepElapsed = useElapsedSeconds(sleepEntry?.startedAt ?? null)
  useSleepTimerNotification(user?.uid ?? null, selectedBaby ?? null, sleepEntry)
  // Screen readers hear when a sleep starts or stops, not the elapsed time's every second.
  const running = sleepEntry != null
  const [announcedRunning, setAnnouncedRunning] = useState<boolean | null>(null)
  const [announcement, setAnnouncement] = useState('')
  if (!loading && announcedRunning !== running) {
    if (announcedRunning !== null) setAnnouncement(running ? 'Sleep timer started.' : 'Sleep timer stopped.')
    setAnnouncedRunning(running)
  }

  if (!household || !selectedBaby) return null

  return (
    <>
      <p role="status" className="visually-hidden">
        {announcement}
      </p>
      {sleepEntry && (
        <div className="active-timers-banner">
          <p>
            <button
              type="button"
              className="link-button"
              aria-label="Sleep in progress, open the timer"
              onClick={() => navigate(SLEEP_TIMER_URL)}
            >
              Sleep in progress for <span aria-hidden="true">{formatElapsed(sleepElapsed)}</span>
            </button>{' '}
            <button
              type="button"
              onClick={() => {
                for (const entry of sleepEntries) {
                  stopSleep(household.id, selectedBaby.id, entry.id).catch(
                    (error: unknown) => alertSleepWriteFailed(error, false),
                  )
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
      )}
    </>
  )
}
