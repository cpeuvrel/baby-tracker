import { subscribeToRecentBathEntries } from '../repositories/bathEntries'
import type { BathEntry } from '../types/models'
import { useRecentEntries } from './useRecentEntries'

export function useRecentBathEntries(
  householdId: string | null,
  babyId: string | null,
  count: number,
): BathEntry[] {
  return useRecentEntries(subscribeToRecentBathEntries, householdId, babyId, count)
}
