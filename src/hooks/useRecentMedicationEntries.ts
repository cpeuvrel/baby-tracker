import { subscribeToRecentMedicationEntries } from '../repositories/medicationEntries'
import type { MedicationEntry } from '../types/models'
import { useRecentEntries, useRecentEntriesState, type EntriesState } from './useRecentEntries'

export function useRecentMedicationEntries(
  householdId: string | null,
  babyId: string | null,
  count: number,
): MedicationEntry[] {
  return useRecentEntries(subscribeToRecentMedicationEntries, householdId, babyId, count)
}

/** Same entries, with the subscription's loading and error state. */
export function useRecentMedicationEntriesState(
  householdId: string | null,
  babyId: string | null,
  count: number,
): EntriesState<MedicationEntry> {
  return useRecentEntriesState(subscribeToRecentMedicationEntries, householdId, babyId, count)
}
