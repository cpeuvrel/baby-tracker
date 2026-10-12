import { subscribeToRecentSleepEntries } from '../repositories/sleepEntries'
import type { SleepEntry } from '../types/models'
import { useRecentEntries, useRecentEntriesState, type EntriesState } from './useRecentEntries'

export function useRecentSleepEntries(
  householdId: string | null,
  babyId: string | null,
  count: number,
): SleepEntry[] {
  return useRecentEntries(subscribeToRecentSleepEntries, householdId, babyId, count)
}

/** Same entries, with the subscription's loading and error state. */
export function useRecentSleepEntriesState(
  householdId: string | null,
  babyId: string | null,
  count: number,
): EntriesState<SleepEntry> {
  return useRecentEntriesState(subscribeToRecentSleepEntries, householdId, babyId, count)
}
