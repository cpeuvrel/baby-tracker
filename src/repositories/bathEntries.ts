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
import { bathEntriesCollection } from '../lib/paths'
import type { DateRange } from '../lib/timeline'
import type { BathEntry } from '../types/models'

function toBathEntry(id: string, data: Record<string, unknown>): BathEntry {
  return {
    id,
    occurredAt: timestampToIso(data.occurredAt as Timestamp),
    notes: (data.notes as string) ?? '',
    createdBy: data.createdBy as string,
    createdAt: timestampToIso(data.createdAt as Timestamp),
  }
}

export function subscribeToBathEntriesInRange(
  householdId: string,
  babyId: string,
  range: DateRange,
  onChange: (entries: BathEntry[]) => void,
): Unsubscribe {
  const rangeQuery = query(
    bathEntriesCollection(householdId, babyId),
    where('occurredAt', '>=', Timestamp.fromDate(range.start)),
    where('occurredAt', '<', Timestamp.fromDate(range.end)),
    orderBy('occurredAt', 'desc'),
  )

  return onSnapshot(rangeQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => toBathEntry(docSnap.id, docSnap.data())))
  })
}

export function subscribeToRecentBathEntries(
  householdId: string,
  babyId: string,
  count: number,
  onChange: (entries: BathEntry[]) => void,
): Unsubscribe {
  const recentQuery = query(
    bathEntriesCollection(householdId, babyId),
    orderBy('occurredAt', 'desc'),
    limit(count),
  )

  return onSnapshot(recentQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => toBathEntry(docSnap.id, docSnap.data())))
  })
}

export async function getAllBathEntries(
  householdId: string,
  babyId: string,
): Promise<BathEntry[]> {
  const allQuery = query(bathEntriesCollection(householdId, babyId), orderBy('occurredAt'))
  const snapshot = await getDocs(allQuery)
  return snapshot.docs.map((docSnap) => toBathEntry(docSnap.id, docSnap.data()))
}

export async function importBathEntries(
  householdId: string,
  babyId: string,
  entries: BathEntry[],
): Promise<void> {
  await batchInsert(bathEntriesCollection(householdId, babyId), entries, (entry) => ({
    occurredAt: Timestamp.fromDate(new Date(entry.occurredAt)),
    notes: entry.notes,
    createdBy: entry.createdBy,
    createdAt: Timestamp.fromDate(new Date(entry.createdAt)),
  }))
}

export interface LogBathInput {
  occurredAt: Date
  notes: string
}

export async function logBath(
  householdId: string,
  babyId: string,
  createdBy: string,
  input: LogBathInput,
): Promise<void> {
  await addDoc(bathEntriesCollection(householdId, babyId), {
    occurredAt: Timestamp.fromDate(input.occurredAt),
    notes: input.notes,
    createdBy,
    createdAt: Timestamp.now(),
  })
}

export async function updateBathEntry(
  householdId: string,
  babyId: string,
  entryId: string,
  input: LogBathInput,
): Promise<void> {
  await updateDoc(doc(bathEntriesCollection(householdId, babyId), entryId), {
    occurredAt: Timestamp.fromDate(input.occurredAt),
    notes: input.notes,
  })
}

export async function deleteBathEntry(
  householdId: string,
  babyId: string,
  entryId: string,
): Promise<void> {
  await deleteDoc(doc(bathEntriesCollection(householdId, babyId), entryId))
}
