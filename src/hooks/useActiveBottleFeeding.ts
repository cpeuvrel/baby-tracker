import { useEffect, useState } from 'react'
import { subscribeToActiveBottleFeeding } from '../repositories/feedingEntries'
import type { FeedingEntry } from '../types/models'

export function useActiveBottleFeeding(
  householdId: string | null,
  babyId: string | null,
): FeedingEntry | null {
  const [entry, setEntry] = useState<FeedingEntry | null>(null)

  useEffect(() => {
    if (!householdId || !babyId) {
      setEntry(null)
      return
    }
    return subscribeToActiveBottleFeeding(householdId, babyId, setEntry)
  }, [householdId, babyId])

  return entry
}
