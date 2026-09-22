import { useEffect, useState } from 'react'
import { subscribeToGrowthEntries } from '../repositories/growthEntries'
import type { GrowthEntry } from '../types/models'

export function useGrowthEntries(householdId: string | null, babyId: string | null): GrowthEntry[] {
  const [entries, setEntries] = useState<GrowthEntry[]>([])

  useEffect(() => {
    if (!householdId || !babyId) {
      setEntries([])
      return
    }
    return subscribeToGrowthEntries(householdId, babyId, setEntries)
  }, [householdId, babyId])

  return entries
}
