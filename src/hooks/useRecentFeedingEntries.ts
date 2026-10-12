import { subscribeToRecentFeedingEntries } from '../repositories/feedingEntries'
import type { FeedingEntry } from '../types/models'
import { useRecentEntries, useRecentEntriesState, type EntriesState } from './useRecentEntries'

export function useRecentFeedingEntries(
  householdId: string | null,
  babyId: string | null,
  count: number,
): FeedingEntry[] {
  return useRecentEntries(subscribeToRecentFeedingEntries, householdId, babyId, count)
}

/** Same entries, with the subscription's loading and error state. */
export function useRecentFeedingEntriesState(
  householdId: string | null,
  babyId: string | null,
  count: number,
): EntriesState<FeedingEntry> {
  return useRecentEntriesState(subscribeToRecentFeedingEntries, householdId, babyId, count)
}
