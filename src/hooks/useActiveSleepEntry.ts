import { useEffect, useState } from 'react'
import { subscribeToActiveSleep } from '../repositories/sleepEntries'
import type { SleepEntry } from '../types/models'

export function useActiveSleepEntry(
  householdId: string | null,
  babyId: string | null,
): SleepEntry | null {
  const [entry, setEntry] = useState<SleepEntry | null>(null)

  useEffect(() => {
    if (!householdId || !babyId) {
      setEntry(null)
      return
    }
    return subscribeToActiveSleep(householdId, babyId, setEntry)
  }, [householdId, babyId])

  return entry
}
