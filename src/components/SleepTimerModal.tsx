import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveSleepEntries } from '../hooks/useActiveSleepEntry'
import { useElapsedSeconds } from '../hooks/useElapsedSeconds'
import { useNow } from '../hooks/useNow'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/datetimeInput'
import { formatDuration, formatElapsed } from '../lib/duration'
import { requestSleepTimerNotificationPermission } from '../lib/sleepTimerNotification'
import { registerPush } from '../lib/pushRegistration'
import { alertSleepAlreadyRunning } from '../lib/sleepAlreadyRunning'
import { logSleep, resumeSleep, startSleep, stopSleep, updateSleepEntry, updateSleepStart } from '../repositories/sleepEntries'
import { DurationInput } from './DurationInput'
import { Modal } from './Modal'
import { DateTimeField } from './DateTimeField'

interface SleepTimerModalProps {
  onClose: () => void
}

export function SleepTimerModal({ onClose }: SleepTimerModalProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const activeEntries = useActiveSleepEntries(household?.id ?? null, selectedBaby?.id ?? null)
  const activeEntry = activeEntries[0] ?? null
  const elapsedSeconds = useElapsedSeconds(activeEntry?.startedAt ?? null)
  const [pendingStart, setPendingStart] = useState(false)
  const [startedAt, setStartedAt] = useState(() => toDatetimeLocalValue(new Date()))
  // Date picker bound, kept current past midnight; handleStartedAtChange still refuses any future time.
  const maxStart = toDatetimeLocalValue(useNow())
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
      ? toDatetimeLocalValue(new Date(fromDatetimeLocalValue(startedAt).getTime() + durationMinutes * 60000))
      : ''

  const handleToggleTimer = () => {
    if (activeEntry) {
      const stoppedAt = new Date()
      const startDate = new Date(activeEntry.startedAt)
      // Stops any sleep started at the same time on another device too.
      for (const entry of activeEntries) {
        void stopSleep(household.id, selectedBaby.id, entry.id, new Date(entry.startedAt))
      }
      setStartedAt(toDatetimeLocalValue(startDate))
      setDurationMinutes(Math.round((stoppedAt.getTime() - startDate.getTime()) / 60000))
      setTimerEntryId(activeEntry.id)
    } else if (!pendingStart) {
      setPendingStart(true)
      // The running timer shows as a notification; this tap is the gesture asking needs.
      // Then this device gets the server's pushes that keep its elapsed time current.
      void requestSleepTimerNotificationPermission()
        .then(() => registerPush(user.uid))
        .catch(() => {})
      // Refused when another device started a sleep this one did not see yet: it shows up instead.
      const onRefused = () => {
        setPendingStart(false)
        alertSleepAlreadyRunning()
      }
      if (timerEntryId) {
        // Start again after a stop: the same sleep goes on, not a new one.
        resumeSleep(household.id, selectedBaby.id, timerEntryId, fromDatetimeLocalValue(startedAt)).catch(onRefused)
        setDurationMinutes(null)
      } else {
        startSleep(household.id, selectedBaby.id, user.uid, fromDatetimeLocalValue(startedAt)).catch(onRefused)
      }
    }
  }

  const handleSave = () => {
    if (timerEntryId) {
      if (!isActive) {
        // Without an end time the sleep runs again: refused if another one runs.
        updateSleepEntry(household.id, selectedBaby.id, timerEntryId, {
          startedAt: fromDatetimeLocalValue(startedAt),
          endedAt: endedAt !== '' ? fromDatetimeLocalValue(endedAt) : null,
          notes,
        }).catch(alertSleepAlreadyRunning)
      }
    } else if (!isActive && endedAt !== '') {
      void logSleep(household.id, selectedBaby.id, user.uid, {
        startedAt: fromDatetimeLocalValue(startedAt),
        endedAt: fromDatetimeLocalValue(endedAt),
        notes,
      })
    }
    onClose()
  }

  const handleStartedAtChange = (value: string) => {
    if (value === '') {
      if (!activeEntry) setStartedAt('')
      return
    }
    // A sleep cannot start in the future.
    const now = new Date()
    const picked = fromDatetimeLocalValue(value)
    const start = picked > now ? now : picked
    if (activeEntry) {
      // The live counter follows the active entry's new start.
      void updateSleepStart(household.id, selectedBaby.id, activeEntry.id, start)
    } else {
      setStartedAt(start === now ? toDatetimeLocalValue(now) : value)
    }
  }

  const handleEndedAtChange = (value: string) => {
    if (value === '') {
      setDurationMinutes(null)
      return
    }
    setDurationMinutes(Math.round((fromDatetimeLocalValue(value).getTime() - fromDatetimeLocalValue(startedAt).getTime()) / 60000))
  }

  const startTimeValue = activeEntry ? toDatetimeLocalValue(new Date(activeEntry.startedAt)) : startedAt
  const counter = isActive
    ? formatElapsed(elapsedSeconds)
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
      <button
        type="button"
        className={isActive ? 'button-action button-timer-stop' : 'button-action button-timer-start'}
        onClick={handleToggleTimer}
        disabled={pendingStart && !isActive}
      >
        {isActive ? 'Stop Timer' : 'Start Timer'}
      </button>
      <DateTimeField
        id="sleep-started-at"
        label="Start Time"
        value={startTimeValue}
        max={maxStart}
        onChange={handleStartedAtChange}
      />
      <DurationInput totalMinutes={durationMinutes} onChange={setDurationMinutes} disabled={isActive} />
      <DateTimeField id="sleep-ended-at" label="End Time" value={endedAt} disabled={isActive} onChange={handleEndedAtChange} />
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
