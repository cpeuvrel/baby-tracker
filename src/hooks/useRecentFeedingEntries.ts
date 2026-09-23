import { subscribeToRecentFeedingEntries } from '../repositories/feedingEntries'
import type { FeedingEntry } from '../types/models'
import { useRecentEntries } from './useRecentEntries'

export function useRecentFeedingEntries(
  householdId: string | null,
  babyId: string | null,
  count: number,
): FeedingEntry[] {
  return useRecentEntries(subscribeToRecentFeedingEntries, householdId, babyId, count)
}
