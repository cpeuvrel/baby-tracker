import type { Unsubscribe } from 'firebase/firestore'
import { useSubscriptionState } from './useSubscriptionState'

export type SubscribeToRecent<T> = (
  householdId: string,
  babyId: string,
  count: number,
  onChange: (entries: T[]) => void,
  onError?: (error: Error) => void,
) => Unsubscribe

export interface EntriesState<T> {
  entries: T[]
  loading: boolean
  error: Error | null
}

const NO_ENTRIES: never[] = []

/** The `count` latest entries of a baby, with the subscription's loading and error state. */
export function useRecentEntriesState<T>(
  subscribe: SubscribeToRecent<T>,
  householdId: string | null,
  babyId: string | null,
  count: number,
): EntriesState<T> {
  const key = householdId && babyId ? `${householdId}/${babyId}/${count}` : null
  const { data, loading, error } = useSubscriptionState<T[]>(
    key,
    (onNext, onError) => subscribe(householdId!, babyId!, count, onNext, onError),
    NO_ENTRIES,
  )
  return { entries: data, loading, error }
}

/** The `count` latest entries of a baby (empty while loading). */
export function useRecentEntries<T>(
  subscribe: SubscribeToRecent<T>,
  householdId: string | null,
  babyId: string | null,
  count: number,
): T[] {
  return useRecentEntriesState(subscribe, householdId, babyId, count).entries
}
