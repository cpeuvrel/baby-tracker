import type { Unsubscribe } from 'firebase/firestore'
import { useEffect, useState } from 'react'

type SubscribeToRecent<T> = (
  householdId: string,
  babyId: string,
  count: number,
  onChange: (entries: T[]) => void,
) => Unsubscribe

export function useRecentEntries<T>(
  subscribe: SubscribeToRecent<T>,
  householdId: string | null,
  babyId: string | null,
  count: number,
): T[] {
  const [entries, setEntries] = useState<T[]>([])

  useEffect(() => {
    if (!householdId || !babyId) {
      setEntries([])
      return
    }
    return subscribe(householdId, babyId, count, setEntries)
  }, [subscribe, householdId, babyId, count])

  return entries
}
