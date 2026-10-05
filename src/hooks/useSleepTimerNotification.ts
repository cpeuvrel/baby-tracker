import { useEffect } from 'react'
import { closeSleepTimerNotification, showSleepTimerNotification } from '../lib/sleepTimerNotification'
import type { SleepEntry } from '../types/models'
import { useNow } from './useNow'

const REFRESH_MS = 60_000
// The active-sleep listener reports "none" until its first snapshot lands:
// wait a moment before closing, so opening the app doesn't flash the notification.
const CLOSE_DELAY_MS = 3000

/** Mirrors the running sleep timer in a system notification that opens the timer when tapped. */
export function useSleepTimerNotification(babyName: string | null, activeEntry: SleepEntry | null): void {
  const now = useNow(REFRESH_MS)
  const startedAt = activeEntry?.startedAt ?? null

  useEffect(() => {
    if (babyName == null || startedAt == null) return
    void showSleepTimerNotification(babyName, new Date(startedAt), now).catch(() => {})
  }, [babyName, startedAt, now])

  useEffect(() => {
    if (startedAt != null) return
    const timer = setTimeout(() => void closeSleepTimerNotification().catch(() => {}), CLOSE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [startedAt])
}
