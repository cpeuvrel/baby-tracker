import { subscribeToActiveSleeps } from '../repositories/sleepEntries'
import type { SleepEntry } from '../types/models'
import type { EntriesState } from './useRecentEntries'
import { useSubscriptionState } from './useSubscriptionState'

const NO_ENTRIES: never[] = []

/** Every sleep in progress, earliest first, with the subscription's loading and error state. */
export function useActiveSleepEntriesState(
  householdId: string | null,
  babyId: string | null,
): EntriesState<SleepEntry> {
  const key = householdId && babyId ? `${householdId}/${babyId}` : null
  const { data, loading, error } = useSubscriptionState<SleepEntry[]>(
    key,
    (onNext, onError) => subscribeToActiveSleeps(householdId!, babyId!, onNext, onError),
    NO_ENTRIES,
  )
  return { entries: data, loading, error }
}

/** Every sleep in progress, earliest first: more than one only when two were started at once. */
export function useActiveSleepEntries(
  householdId: string | null,
  babyId: string | null,
): SleepEntry[] {
  return useActiveSleepEntriesState(householdId, babyId).entries
}

/** The sleep in progress (the earliest, should two run). */
export function useActiveSleepEntry(
  householdId: string | null,
  babyId: string | null,
): SleepEntry | null {
  return useActiveSleepEntries(householdId, babyId)[0] ?? null
}
