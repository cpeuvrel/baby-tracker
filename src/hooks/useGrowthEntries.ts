import { subscribeToGrowthEntries } from '../repositories/growthEntries'
import type { GrowthEntry } from '../types/models'
import type { EntriesState } from './useRecentEntries'
import { useSubscriptionState } from './useSubscriptionState'

const NO_ENTRIES: never[] = []

/** Every growth measurement of the baby, with the subscription's loading and error state. */
export function useGrowthEntriesState(
  householdId: string | null,
  babyId: string | null,
): EntriesState<GrowthEntry> {
  const key = householdId && babyId ? `${householdId}/${babyId}` : null
  const { data, loading, error } = useSubscriptionState<GrowthEntry[]>(
    key,
    (onNext, onError) => subscribeToGrowthEntries(householdId!, babyId!, onNext, onError),
    NO_ENTRIES,
  )
  return { entries: data, loading, error }
}

/** Every growth measurement of the baby (empty while loading). */
export function useGrowthEntries(householdId: string | null, babyId: string | null): GrowthEntry[] {
  return useGrowthEntriesState(householdId, babyId).entries
}
