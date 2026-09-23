import { subscribeToRecentDiaperEntries } from '../repositories/diaperEntries'
import type { DiaperEntry } from '../types/models'
import { useRecentEntries } from './useRecentEntries'

export function useRecentDiaperEntries(
  householdId: string | null,
  babyId: string | null,
  count: number,
): DiaperEntry[] {
  return useRecentEntries(subscribeToRecentDiaperEntries, householdId, babyId, count)
}
