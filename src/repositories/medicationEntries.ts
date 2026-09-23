import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { batchInsert } from '../lib/firestoreBatch'
import { timestampToIso } from '../lib/firestoreDates'
import { medicationEntriesCollection } from '../lib/paths'
import type { DateRange } from '../lib/timeline'
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

export function subscribeToMedicationEntriesInRange(
  householdId: string,
  babyId: string,
  range: DateRange,
  onChange: (entries: MedicationEntry[]) => void,
): Unsubscribe {
  const rangeQuery = query(
    medicationEntriesCollection(householdId, babyId),
    where('givenAt', '>=', Timestamp.fromDate(range.start)),
    where('givenAt', '<', Timestamp.fromDate(range.end)),
    orderBy('givenAt', 'desc'),
  )

  return onSnapshot(rangeQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => toMedicationEntry(docSnap.id, docSnap.data())))
  })
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

export async function getAllMedicationEntries(
  householdId: string,
  babyId: string,
): Promise<MedicationEntry[]> {
  const allQuery = query(medicationEntriesCollection(householdId, babyId), orderBy('givenAt'))
  const snapshot = await getDocs(allQuery)
  return snapshot.docs.map((docSnap) => toMedicationEntry(docSnap.id, docSnap.data()))
}

export async function importMedicationEntries(
  householdId: string,
  babyId: string,
  entries: MedicationEntry[],
): Promise<void> {
  await batchInsert(medicationEntriesCollection(householdId, babyId), entries, (entry) => ({
    name: entry.name,
    givenAt: Timestamp.fromDate(new Date(entry.givenAt)),
    dose: entry.dose,
    notes: entry.notes,
    createdBy: entry.createdBy,
    createdAt: Timestamp.fromDate(new Date(entry.createdAt)),
  }))
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

export async function updateMedicationEntry(
  householdId: string,
  babyId: string,
  entryId: string,
  input: LogMedicationInput,
): Promise<void> {
  await updateDoc(doc(medicationEntriesCollection(householdId, babyId), entryId), {
    name: input.name,
    givenAt: Timestamp.fromDate(input.givenAt),
    dose: input.dose,
    notes: input.notes,
  })
}

export async function deleteMedicationEntry(
  householdId: string,
  babyId: string,
  entryId: string,
): Promise<void> {
  await deleteDoc(doc(medicationEntriesCollection(householdId, babyId), entryId))
}
