import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { batchInsert } from '../lib/firestoreBatch'
import { timestampToIso } from '../lib/firestoreDates'
import { listenerErrorHandler, mapDocs } from '../lib/firestoreSnapshots'
import { growthEntriesCollection } from '../lib/paths'
import type { GrowthEntry } from '../types/models'

export interface GrowthMeasurement {
  measuredAt: Date
  weightG: number | null
  heightMm: number | null
  headCircumferenceMm: number | null
  notes: string
}

function toGrowthEntry(id: string, data: Record<string, unknown>): GrowthEntry {
  return {
    id,
    measuredAt: timestampToIso(data.measuredAt),
    weightG: (data.weightG as number | null) ?? null,
    heightMm: (data.heightMm as number | null) ?? null,
    headCircumferenceMm: (data.headCircumferenceMm as number | null) ?? null,
    notes: (data.notes as string) ?? '',
    createdBy: data.createdBy as string,
    createdAt: timestampToIso(data.createdAt ?? data.measuredAt),
  }
}

export function subscribeToGrowthEntries(
  householdId: string,
  babyId: string,
  onChange: (entries: GrowthEntry[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const growthQuery = query(growthEntriesCollection(householdId, babyId), orderBy('measuredAt'))

  return onSnapshot(
    growthQuery,
    (snapshot) => {
      onChange(mapDocs(snapshot, toGrowthEntry))
    },
    listenerErrorHandler('growthEntries', onError),
  )
}

export async function getAllGrowthEntries(
  householdId: string,
  babyId: string,
): Promise<GrowthEntry[]> {
  const allQuery = query(growthEntriesCollection(householdId, babyId), orderBy('measuredAt'))
  const snapshot = await getDocs(allQuery)
  return mapDocs(snapshot, toGrowthEntry)
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
  await addDoc(growthEntriesCollection(householdId, babyId), {
    measuredAt: Timestamp.fromDate(measurement.measuredAt),
    weightG: measurement.weightG,
    heightMm: measurement.heightMm,
    headCircumferenceMm: measurement.headCircumferenceMm,
    notes: measurement.notes,
    createdBy,
    createdAt: Timestamp.now(),
  })
}

export async function updateGrowthEntry(
  householdId: string,
  babyId: string,
  entryId: string,
  measurement: GrowthMeasurement,
): Promise<void> {
  await updateDoc(doc(growthEntriesCollection(householdId, babyId), entryId), {
    measuredAt: Timestamp.fromDate(measurement.measuredAt),
    weightG: measurement.weightG,
    heightMm: measurement.heightMm,
    headCircumferenceMm: measurement.headCircumferenceMm,
    notes: measurement.notes,
  })
}

export async function deleteGrowthEntry(
  householdId: string,
  babyId: string,
  entryId: string,
): Promise<void> {
  await deleteDoc(doc(growthEntriesCollection(householdId, babyId), entryId))
}
