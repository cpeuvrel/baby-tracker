import { subscribeToRecentBathEntries } from '../repositories/bathEntries'
import type { BathEntry } from '../types/models'
import { useRecentEntries, useRecentEntriesState, type EntriesState } from './useRecentEntries'

export function useRecentBathEntries(
  householdId: string | null,
  babyId: string | null,
  count: number,
): BathEntry[] {
  return useRecentEntries(subscribeToRecentBathEntries, householdId, babyId, count)
}

/** Same entries, with the subscription's loading and error state. */
export function useRecentBathEntriesState(
  householdId: string | null,
  babyId: string | null,
  count: number,
): EntriesState<BathEntry> {
  return useRecentEntriesState(subscribeToRecentBathEntries, householdId, babyId, count)
}
