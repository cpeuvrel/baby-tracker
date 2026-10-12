import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useHousehold } from '../contexts/HouseholdContext'
import {
  closeSleepTimerNotification,
  showSleepTimerNotification,
  SLEEP_TIMER_BABY_PARAM,
} from '../lib/sleepTimerNotification'
import { registerPush } from '../lib/pushRegistration'
import type { Baby, SleepEntry } from '../types/models'
import { useNow } from './useNow'

const REFRESH_MS = 60_000
// The active-sleep listener reports "none" until its first snapshot lands:
// wait a moment before closing, so opening the app doesn't flash the notification.
export const CLOSE_DELAY_MS = 3000

/**
 * Mirrors the selected baby's running sleep timer in a system notification
 * (one per baby) that opens the timer when tapped. Only ever closes the
 * notification of that baby: another child's keeps going while it sleeps.
 */
export function useSleepTimerNotification(
  uid: string | null,
  baby: Pick<Baby, 'id' | 'name'> | null,
  activeEntry: SleepEntry | null,
): void {
  const now = useNow(REFRESH_MS)
  const startedAt = activeEntry?.startedAt ?? null
  const babyId = baby?.id ?? null
  const babyName = baby?.name ?? null

  useEffect(() => {
    if (babyId == null || babyName == null || startedAt == null) return
    void showSleepTimerNotification(babyId, babyName, new Date(startedAt), now).catch(() => {})
  }, [babyId, babyName, startedAt, now])

  // A device that already allowed notifications (e.g. another parent's phone)
  // also gets the server's pushes while a sleep runs.
  useEffect(() => {
    if (uid == null || startedAt == null) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    void registerPush(uid).catch(() => {})
  }, [uid, startedAt])

  useEffect(() => {
    if (babyId == null || startedAt != null) return
    const timer = setTimeout(() => void closeSleepTimerNotification(babyId).catch(() => {}), CLOSE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [babyId, startedAt])
}

/**
 * A `?baby=` param (the tap on a baby's timer notification) selects that child,
 * once per link: picking another child afterwards is not undone.
 */
export function useSleepTimerBabyParam(): void {
  const [searchParams] = useSearchParams()
  const { babies, selectedBaby, selectBaby } = useHousehold()
  const wantedBabyId = searchParams.get(SLEEP_TIMER_BABY_PARAM)
  const appliedRef = useRef<string | null>(null)

  useEffect(() => {
    if (wantedBabyId == null) {
      appliedRef.current = null
      return
    }
    if (appliedRef.current === wantedBabyId) return
    if (!babies.some((candidate) => candidate.id === wantedBabyId)) return
    appliedRef.current = wantedBabyId
    if (selectedBaby?.id !== wantedBabyId) selectBaby(wantedBabyId)
  }, [wantedBabyId, babies, selectedBaby, selectBaby])
}
