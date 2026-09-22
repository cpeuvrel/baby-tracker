import {
  addDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { batchInsert } from '../lib/firestoreBatch'
import { timestampToIso } from '../lib/firestoreDates'
import { growthEntriesCollection } from '../lib/paths'
import type { GrowthEntry } from '../types/models'

export interface GrowthMeasurement {
  weightG: number | null
  heightMm: number | null
  headCircumferenceMm: number | null
}

function toGrowthEntry(id: string, data: Record<string, unknown>): GrowthEntry {
  return {
    id,
    measuredAt: timestampToIso(data.measuredAt as Timestamp),
    weightG: (data.weightG as number | null) ?? null,
    heightMm: (data.heightMm as number | null) ?? null,
    headCircumferenceMm: (data.headCircumferenceMm as number | null) ?? null,
    notes: (data.notes as string) ?? '',
    createdBy: data.createdBy as string,
    createdAt: timestampToIso(data.createdAt as Timestamp),
  }
}

export function subscribeToGrowthEntries(
  householdId: string,
  babyId: string,
  onChange: (entries: GrowthEntry[]) => void,
): Unsubscribe {
  const growthQuery = query(growthEntriesCollection(householdId, babyId), orderBy('measuredAt'))

  return onSnapshot(growthQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => toGrowthEntry(docSnap.id, docSnap.data())))
  })
}

export async function getAllGrowthEntries(
  householdId: string,
  babyId: string,
): Promise<GrowthEntry[]> {
  const allQuery = query(growthEntriesCollection(householdId, babyId), orderBy('measuredAt'))
  const snapshot = await getDocs(allQuery)
  return snapshot.docs.map((docSnap) => toGrowthEntry(docSnap.id, docSnap.data()))
}

export async function importGrowthEntries(
  householdId: string,
  babyId: string,
  entries: GrowthEntry[],
): Promise<void> {
  await batchInsert(growthEntriesCollection(householdId, babyId), entries, (entry) => ({
    measuredAt: Timestamp.fromDate(new Date(entry.measuredAt)),
    weightG: entry.weightG,
    heightMm: entry.heightMm,
    headCircumferenceMm: entry.headCircumferenceMm,
    notes: entry.notes,
    createdBy: entry.createdBy,
    createdAt: Timestamp.fromDate(new Date(entry.createdAt)),
  }))
}

export async function addGrowthEntry(
  householdId: string,
  babyId: string,
  createdBy: string,
  measurement: GrowthMeasurement,
): Promise<void> {
  const now = Timestamp.now()
  await addDoc(growthEntriesCollection(householdId, babyId), {
    measuredAt: now,
    weightG: measurement.weightG,
    heightMm: measurement.heightMm,
    headCircumferenceMm: measurement.headCircumferenceMm,
    notes: '',
    createdBy,
    createdAt: now,
  })
}
