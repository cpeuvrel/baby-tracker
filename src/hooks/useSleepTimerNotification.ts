import { useEffect, useState } from 'react'
import {
  closeSleepTimerNotification,
  refreshSleepTimerNotification,
  showSleepTimerNotification,
} from '../lib/sleepTimerNotification'
import { unmuteSleepTimer } from '../lib/pushRegistration'
import type { SleepEntry } from '../types/models'
import { useNow } from './useNow'

const REFRESH_MS = 60_000
// The active-sleep listener reports "none" until its first snapshot lands:
// wait a moment before closing, so opening the app doesn't flash the notification.
const CLOSE_DELAY_MS = 3000

/** Counts the times the app comes back to the foreground. */
function useForegroundCount(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') setCount((value) => value + 1)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])
  return count
}

/**
 * Mirrors the running sleep timer in a system notification that opens the timer when tapped.
 * Swiped away, it stays away for that sleep until the app is opened again.
 */
export function useSleepTimerNotification(
  uid: string | null,
  babyName: string | null,
  activeEntry: SleepEntry | null,
): void {
  const now = useNow(REFRESH_MS)
  const foregroundCount = useForegroundCount()
  const startedAt = activeEntry?.startedAt ?? null
  const entryId = activeEntry?.id ?? null

  // Opening the app, or coming back to it, shows the notification again.
  useEffect(() => {
    if (babyName == null || startedAt == null || entryId == null) return
    void showSleepTimerNotification(babyName, new Date(startedAt), new Date(), entryId).catch(() => {})
  }, [babyName, startedAt, entryId, foregroundCount])

  // Minute ticks only update a notification still on screen.
  useEffect(() => {
    if (babyName == null || startedAt == null || entryId == null) return
    void refreshSleepTimerNotification(babyName, new Date(startedAt), now, entryId).catch(() => {})
  }, [babyName, startedAt, entryId, now])

  // A device that already allowed notifications (e.g. another parent's phone)
  // also gets the server's pushes while a sleep runs, swiped away or not before.
  useEffect(() => {
    if (uid == null || startedAt == null) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    void unmuteSleepTimer(uid).catch(() => {})
  }, [uid, startedAt, foregroundCount])

  useEffect(() => {
    if (startedAt != null) return
    const timer = setTimeout(() => void closeSleepTimerNotification().catch(() => {}), CLOSE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [startedAt])
}
