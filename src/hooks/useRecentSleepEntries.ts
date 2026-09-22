import { subscribeToRecentSleepEntries } from '../repositories/sleepEntries'
import type { SleepEntry } from '../types/models'
import { useRecentEntries } from './useRecentEntries'

export function useRecentSleepEntries(
  householdId: string | null,
  babyId: string | null,
  count: number,
): SleepEntry[] {
  return useRecentEntries(subscribeToRecentSleepEntries, householdId, babyId, count)
}
