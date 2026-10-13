import { subscribeToRecentDiaperEntries } from '../repositories/diaperEntries'
import type { DiaperEntry } from '../types/models'
import { useRecentEntries, useRecentEntriesState, type EntriesState } from './useRecentEntries'

export function useRecentDiaperEntries(
  householdId: string | null,
  babyId: string | null,
  count: number,
): DiaperEntry[] {
  return useRecentEntries(subscribeToRecentDiaperEntries, householdId, babyId, count)
}

/** Same entries, with the subscription's loading and error state. */
export function useRecentDiaperEntriesState(
  householdId: string | null,
  babyId: string | null,
  count: number,
): EntriesState<DiaperEntry> {
  return useRecentEntriesState(subscribeToRecentDiaperEntries, householdId, babyId, count)
}
