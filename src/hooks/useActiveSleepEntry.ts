import { useEffect, useState } from 'react'
import { subscribeToActiveSleeps } from '../repositories/sleepEntries'
import type { SleepEntry } from '../types/models'

/** Every sleep in progress, earliest first: more than one only when two were started at once. */
export function useActiveSleepEntries(
  householdId: string | null,
  babyId: string | null,
): SleepEntry[] {
  const [entries, setEntries] = useState<SleepEntry[]>([])

  useEffect(() => {
    if (!householdId || !babyId) {
      setEntries([])
      return
    }
    return subscribeToActiveSleeps(householdId, babyId, setEntries)
  }, [householdId, babyId])

  return entries
}

/** The sleep in progress (the earliest, should two run). */
export function useActiveSleepEntry(
  householdId: string | null,
  babyId: string | null,
): SleepEntry | null {
  return useActiveSleepEntries(householdId, babyId)[0] ?? null
}
