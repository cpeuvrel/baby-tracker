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
import { feedingEntriesCollection } from '../lib/paths'
import type { DateRange } from '../lib/timeline'
import type { FeedingEntry, FeedingType } from '../types/models'

function toFeedingEntry(id: string, data: Record<string, unknown>): FeedingEntry {
  return {
    id,
    type: data.type as FeedingType,
    occurredAt: timestampToIso(data.occurredAt as Timestamp),
    volumeMl: (data.volumeMl as number | null) ?? null,
    foodType: (data.foodType as string | null) ?? null,
    notes: (data.notes as string) ?? '',
    createdBy: data.createdBy as string,
    createdAt: timestampToIso(data.createdAt as Timestamp),
  }
}

export function subscribeToFeedingEntriesInRange(
  householdId: string,
  babyId: string,
  range: DateRange,
  onChange: (entries: FeedingEntry[]) => void,
): Unsubscribe {
  const rangeQuery = query(
    feedingEntriesCollection(householdId, babyId),
    where('occurredAt', '>=', Timestamp.fromDate(range.start)),
    where('occurredAt', '<', Timestamp.fromDate(range.end)),
    orderBy('occurredAt', 'desc'),
  )

  return onSnapshot(rangeQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => toFeedingEntry(docSnap.id, docSnap.data())))
  })
}

export function subscribeToRecentFeedingEntries(
  householdId: string,
  babyId: string,
  count: number,
  onChange: (entries: FeedingEntry[]) => void,
): Unsubscribe {
  const recentQuery = query(
    feedingEntriesCollection(householdId, babyId),
    orderBy('occurredAt', 'desc'),
    limit(count),
  )

  return onSnapshot(recentQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => toFeedingEntry(docSnap.id, docSnap.data())))
  })
}

export async function getAllFeedingEntries(
  householdId: string,
  babyId: string,
): Promise<FeedingEntry[]> {
  const allQuery = query(feedingEntriesCollection(householdId, babyId), orderBy('occurredAt'))
  const snapshot = await getDocs(allQuery)
  return snapshot.docs.map((docSnap) => toFeedingEntry(docSnap.id, docSnap.data()))
}

export async function importFeedingEntries(
  householdId: string,
  babyId: string,
  entries: FeedingEntry[],
): Promise<void> {
  await batchInsert(feedingEntriesCollection(householdId, babyId), entries, (entry) => ({
    type: entry.type,
    occurredAt: Timestamp.fromDate(new Date(entry.occurredAt)),
    volumeMl: entry.volumeMl,
    foodType: entry.foodType,
    notes: entry.notes,
    createdBy: entry.createdBy,
    createdAt: Timestamp.fromDate(new Date(entry.createdAt)),
  }))
}

export interface LogFeedingInput {
  type: FeedingType
  occurredAt: Date
  volumeMl: number | null
  foodType: string | null
  notes: string
}

export async function logFeeding(
  householdId: string,
  babyId: string,
  createdBy: string,
  input: LogFeedingInput,
): Promise<void> {
  await addDoc(feedingEntriesCollection(householdId, babyId), {
    type: input.type,
    occurredAt: Timestamp.fromDate(input.occurredAt),
    volumeMl: input.volumeMl,
    foodType: input.foodType,
    notes: input.notes,
    createdBy,
    createdAt: Timestamp.now(),
  })
}

export async function updateFeedingEntry(
  householdId: string,
  babyId: string,
  entryId: string,
  input: LogFeedingInput,
): Promise<void> {
  await updateDoc(doc(feedingEntriesCollection(householdId, babyId), entryId), {
    type: input.type,
    occurredAt: Timestamp.fromDate(input.occurredAt),
    volumeMl: input.volumeMl,
    foodType: input.foodType,
    notes: input.notes,
  })
}

export async function deleteFeedingEntry(
  householdId: string,
  babyId: string,
  entryId: string,
): Promise<void> {
  await deleteDoc(doc(feedingEntriesCollection(householdId, babyId), entryId))
}
