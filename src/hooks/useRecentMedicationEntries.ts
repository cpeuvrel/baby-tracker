import { subscribeToRecentMedicationEntries } from '../repositories/medicationEntries'
import type { MedicationEntry } from '../types/models'
import { useRecentEntries } from './useRecentEntries'

export function useRecentMedicationEntries(
  householdId: string | null,
  babyId: string | null,
  count: number,
): MedicationEntry[] {
  return useRecentEntries(subscribeToRecentMedicationEntries, householdId, babyId, count)
}
