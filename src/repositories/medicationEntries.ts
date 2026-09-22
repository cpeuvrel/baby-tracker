import {
  addDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { timestampToIso } from '../lib/firestoreDates'
import { medicationEntriesCollection } from '../lib/paths'
import type { MedicationEntry } from '../types/models'

function toMedicationEntry(id: string, data: Record<string, unknown>): MedicationEntry {
  return {
    id,
    name: data.name as string,
    givenAt: timestampToIso(data.givenAt as Timestamp),
    dose: (data.dose as string) ?? '',
    notes: (data.notes as string) ?? '',
    createdBy: data.createdBy as string,
    createdAt: timestampToIso(data.createdAt as Timestamp),
  }
}

export function subscribeToRecentMedicationEntries(
  householdId: string,
  babyId: string,
  count: number,
  onChange: (entries: MedicationEntry[]) => void,
): Unsubscribe {
  const recentQuery = query(
    medicationEntriesCollection(householdId, babyId),
    orderBy('givenAt', 'desc'),
    limit(count),
  )

  return onSnapshot(recentQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => toMedicationEntry(docSnap.id, docSnap.data())))
  })
}

export interface LogMedicationInput {
  name: string
  givenAt: Date
  dose: string
  notes: string
}

export async function logMedication(
  householdId: string,
  babyId: string,
  createdBy: string,
  input: LogMedicationInput,
): Promise<void> {
  await addDoc(medicationEntriesCollection(householdId, babyId), {
    name: input.name,
    givenAt: Timestamp.fromDate(input.givenAt),
    dose: input.dose,
    notes: input.notes,
    createdBy,
    createdAt: Timestamp.now(),
  })
}
