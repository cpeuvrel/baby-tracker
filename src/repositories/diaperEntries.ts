import {
  addDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { batchInsert } from '../lib/firestoreBatch'
import { timestampToIso } from '../lib/firestoreDates'
import { diaperEntriesCollection } from '../lib/paths'
import type { DateRange } from '../lib/timeline'
import type { DiaperEntry, DiaperType } from '../types/models'

function toDiaperEntry(id: string, data: Record<string, unknown>): DiaperEntry {
  return {
    id,
    type: data.type as DiaperType,
    occurredAt: timestampToIso(data.occurredAt as Timestamp),
    notes: (data.notes as string) ?? '',
    createdBy: data.createdBy as string,
    createdAt: timestampToIso(data.createdAt as Timestamp),
  }
}

export function subscribeToDiaperEntriesInRange(
  householdId: string,
  babyId: string,
  range: DateRange,
  onChange: (entries: DiaperEntry[]) => void,
): Unsubscribe {
  const rangeQuery = query(
    diaperEntriesCollection(householdId, babyId),
    where('occurredAt', '>=', Timestamp.fromDate(range.start)),
    where('occurredAt', '<', Timestamp.fromDate(range.end)),
    orderBy('occurredAt', 'desc'),
  )

  return onSnapshot(rangeQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => toDiaperEntry(docSnap.id, docSnap.data())))
  })
}

export function subscribeToRecentDiaperEntries(
  householdId: string,
  babyId: string,
  count: number,
  onChange: (entries: DiaperEntry[]) => void,
): Unsubscribe {
  const recentQuery = query(
    diaperEntriesCollection(householdId, babyId),
    orderBy('occurredAt', 'desc'),
    limit(count),
  )

  return onSnapshot(recentQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => toDiaperEntry(docSnap.id, docSnap.data())))
  })
}

export async function getAllDiaperEntries(
  householdId: string,
  babyId: string,
): Promise<DiaperEntry[]> {
  const allQuery = query(diaperEntriesCollection(householdId, babyId), orderBy('occurredAt'))
  const snapshot = await getDocs(allQuery)
  return snapshot.docs.map((docSnap) => toDiaperEntry(docSnap.id, docSnap.data()))
}

export async function importDiaperEntries(
  householdId: string,
  babyId: string,
  entries: DiaperEntry[],
): Promise<void> {
  await batchInsert(diaperEntriesCollection(householdId, babyId), entries, (entry) => ({
    type: entry.type,
    occurredAt: Timestamp.fromDate(new Date(entry.occurredAt)),
    notes: entry.notes,
    createdBy: entry.createdBy,
    createdAt: Timestamp.fromDate(new Date(entry.createdAt)),
  }))
}

export async function logDiaper(
  householdId: string,
  babyId: string,
  createdBy: string,
  type: DiaperType,
  notes: string,
): Promise<void> {
  const now = Timestamp.now()
  await addDoc(diaperEntriesCollection(householdId, babyId), {
    type,
    occurredAt: now,
    notes,
    createdBy,
    createdAt: now,
  })
}
