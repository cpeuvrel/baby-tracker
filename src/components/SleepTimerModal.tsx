import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useActiveSleepEntriesState } from '../hooks/useActiveSleepEntry'
import { useElapsedSeconds } from '../hooks/useElapsedSeconds'
import { useNow } from '../hooks/useNow'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/datetimeInput'
import { formatDuration, formatElapsed } from '../lib/duration'
import { registerPush } from '../lib/pushRegistration'
import { alertSleepWriteFailed } from '../lib/sleepAlreadyRunning'
import {
  logSleep,
  resumeSleep,
  startSleep,
  stopSleep,
  updateSleepEntry,
  updateSleepStart,
} from '../repositories/sleepEntries'
import { DurationInput } from './DurationInput'
import { Modal } from './Modal'
import { DateTimeField } from './DateTimeField'

interface SleepTimerModalProps {
  onClose: () => void
}

/** Reports a failed write; `lockInvolved` for the writes that take the sleep timer lock. */
function reportFailure(lockInvolved: boolean) {
  return (error: unknown) => alertSleepWriteFailed(error, lockInvolved)
}

export function SleepTimerModal({ onClose }: SleepTimerModalProps) {
  const { user } = useAuth()
  const { household, selectedBaby } = useHousehold()
  const { entries: activeEntries, loading: activeLoading } = useActiveSleepEntriesState(
    household?.id ?? null,
    selectedBaby?.id ?? null,
  )
  const activeEntry = activeEntries[0] ?? null
  const elapsedSeconds = useElapsedSeconds(activeEntry?.startedAt ?? null)
  const [pendingStart, setPendingStart] = useState(false)
  const [startedAt, setStartedAt] = useState(() => toDatetimeLocalValue(new Date()))
  // Until the start time is edited, Start Timer starts at the tap, not when the modal opened.
  const [startTouched, setStartTouched] = useState(false)
  // A running sleep's start being edited: written when the field loses the focus or on Save.
  const [startDraft, setStartDraft] = useState<string | null>(null)
  // Date picker bound, kept current past midnight; handleStartedAtChange still refuses any future time.
  const maxStart = toDatetimeLocalValue(useNow())
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null)
  const [timerEntryId, setTimerEntryId] = useState<string | null>(null)
  // Notes are no longer edited in this popup (main #56): a running sleep keeps its own, and so
  // does the one just stopped (its entry is no longer active while the form stays open).
  const [stoppedNotes, setStoppedNotes] = useState('')
  const notes = activeEntry?.notes ?? stoppedNotes
  const isActive = activeEntry != null
  // Announced once, when the timer starts or stops (not the counter's every second).
  const [announcedActive, setAnnouncedActive] = useState<boolean | null>(null)
  const [announcement, setAnnouncement] = useState('')
  if (!activeLoading && announcedActive !== isActive) {
    if (announcedActive !== null) setAnnouncement(isActive ? 'Sleep timer started.' : 'Sleep timer stopped.')
    setAnnouncedActive(isActive)
  }

  // The sleep being on record ends the wait for its start to be written.
  if (activeEntry && pendingStart) setPendingStart(false)

  if (!household || !selectedBaby || !user) return null

  const endedAt =
    durationMinutes != null && startedAt !== ''
      ? toDatetimeLocalValue(new Date(fromDatetimeLocalValue(startedAt).getTime() + durationMinutes * 60000))
      : ''
  const endBeforeStart = !isActive && durationMinutes != null && durationMinutes < 0

  /** Writes the edited start of the running sleep, if any; returns the start it now has. */
  const commitStartDraft = (): Date | null => {
    if (!activeEntry || startDraft == null) return null
    setStartDraft(null)
    const start = fromDatetimeLocalValue(startDraft)
    if (start.getTime() !== new Date(activeEntry.startedAt).getTime()) {
      updateSleepStart(household.id, selectedBaby.id, activeEntry.id, start).catch(reportFailure(false))
    }
    return start
  }

  const handleToggleTimer = () => {
    if (activeEntry) {
      const stoppedAt = new Date()
      const startDate = commitStartDraft() ?? new Date(activeEntry.startedAt)
      // Stops any sleep started at the same time on another device too.
      for (const entry of activeEntries) {
        const entryStart = entry.id === activeEntry.id ? startDate : new Date(entry.startedAt)
        stopSleep(household.id, selectedBaby.id, entry.id, entryStart).catch(reportFailure(false))
      }
      setStartedAt(toDatetimeLocalValue(startDate))
      setDurationMinutes(Math.round((stoppedAt.getTime() - startDate.getTime()) / 60000))
      setTimerEntryId(activeEntry.id)
      setStoppedNotes(activeEntry.notes)
    } else if (!pendingStart) {
      setPendingStart(true)
      // The running timer shows as a notification; this tap is the gesture asking needs.
      // Then this device gets the server's pushes that keep its elapsed time current.
      void registerPush(user.uid).catch(() => {})
      // Refused when another device started a sleep this one did not see yet: it shows up instead.
      const onRefused = (error: unknown) => {
        setPendingStart(false)
        alertSleepWriteFailed(error, true)
      }
      if (timerEntryId) {
        // Start again after a stop: the same sleep goes on, not a new one.
        resumeSleep(household.id, selectedBaby.id, timerEntryId, fromDatetimeLocalValue(startedAt), notes).catch(
          onRefused,
        )
        setDurationMinutes(null)
      } else {
        const start = startTouched && startedAt !== '' ? fromDatetimeLocalValue(startedAt) : new Date()
        setStartedAt(toDatetimeLocalValue(start))
        startSleep(household.id, selectedBaby.id, user.uid, start, notes).catch(onRefused)
      }
    }
  }

  const handleSave = () => {
    if (endBeforeStart) return
    if (activeEntry) {
      commitStartDraft()
    } else if (timerEntryId) {
      // Without an end time the sleep runs again: refused if another one runs.
      const lockInvolved = endedAt === ''
      updateSleepEntry(household.id, selectedBaby.id, timerEntryId, {
        startedAt: fromDatetimeLocalValue(startedAt),
        endedAt: endedAt !== '' ? fromDatetimeLocalValue(endedAt) : null,
        notes,
      }).catch(reportFailure(lockInvolved))
    } else if (endedAt !== '') {
      logSleep(household.id, selectedBaby.id, user.uid, {
        startedAt: fromDatetimeLocalValue(startedAt),
        endedAt: fromDatetimeLocalValue(endedAt),
        notes,
      }).catch(reportFailure(false))
    }
    onClose()
  }

  const handleStartedAtChange = (value: string) => {
    if (value === '') {
      if (!activeEntry) {
        setStartedAt('')
        setStartTouched(true)
      }
      return
    }
    // A sleep cannot start in the future.
    const now = new Date()
    const picked = fromDatetimeLocalValue(value)
    const start = picked > now ? now : picked
    const shown = start === now ? toDatetimeLocalValue(now) : value
    if (activeEntry) {
      setStartDraft(shown)
    } else {
      // A stopped timer ended when Stop was tapped: moving its start keeps that end (the
      // duration changes), else the end would follow the start, up into the future.
      if (timerEntryId && endedAt !== '') {
        setDurationMinutes(Math.round((fromDatetimeLocalValue(endedAt).getTime() - start.getTime()) / 60000))
      }
      setStartedAt(shown)
      setStartTouched(true)
    }
  }

  const handleEndedAtChange = (value: string) => {
    if (value === '' || startedAt === '') {
      setDurationMinutes(null)
      return
    }
    setDurationMinutes(Math.round((fromDatetimeLocalValue(value).getTime() - fromDatetimeLocalValue(startedAt).getTime()) / 60000))
  }

  const startTimeValue = activeEntry ? (startDraft ?? toDatetimeLocalValue(new Date(activeEntry.startedAt))) : startedAt
  const counter = isActive
    ? formatElapsed(elapsedSeconds)
    : pendingStart
      ? 'Starting…'
      : durationMinutes != null && durationMinutes >= 0
        ? formatDuration(durationMinutes * 60)
        : '—'

  return (
    <Modal
      title="Sleep"
      bandColorVar="--category-sleep"
      onClose={onClose}
      headerAction={{ label: 'Save', onClick: handleSave, disabled: endBeforeStart }}
    >
      <p className="modal-field-label">Total Time</p>
      {/* Read every second, the counter is not announced: the status line below says when it starts or stops. */}
      <p className="modal-counter" aria-hidden="true">
        {counter}
      </p>
      <p role="status" className="visually-hidden">
        {announcement}
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
        onBlur={() => {
          commitStartDraft()
        }}
      />
      <DurationInput totalMinutes={durationMinutes} onChange={setDurationMinutes} disabled={isActive} />
      <DateTimeField id="sleep-ended-at" label="End Time" value={endedAt} disabled={isActive} onChange={handleEndedAtChange} />
      {endBeforeStart && (
        <p role="alert" className="form-error">
          End time must be after start time.
        </p>
      )}
    </Modal>
  )
}
