import {
  addDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { secondsBetween } from '../lib/duration'
import { nullableTimestampToIso, timestampToIso } from '../lib/firestoreDates'
import { feedingEntriesCollection } from '../lib/paths'
import { dayRange } from '../lib/timeline'
import type { FeedingEntry, FeedingType } from '../types/models'

function toFeedingEntry(id: string, data: Record<string, unknown>): FeedingEntry {
  return {
    id,
    type: data.type as FeedingType,
    startedAt: timestampToIso(data.startedAt as Timestamp),
    endedAt: nullableTimestampToIso(data.endedAt as Timestamp | null),
    durationSeconds: (data.durationSeconds as number | null) ?? null,
    volumeMl: (data.volumeMl as number | null) ?? null,
    notes: (data.notes as string) ?? '',
    createdBy: data.createdBy as string,
    createdAt: timestampToIso(data.createdAt as Timestamp),
  }
}

export function subscribeToActiveBottleFeeding(
  householdId: string,
  babyId: string,
  onChange: (entry: FeedingEntry | null) => void,
): Unsubscribe {
  const activeQuery = query(
    feedingEntriesCollection(householdId, babyId),
    where('type', '==', 'bottle'),
    where('endedAt', '==', null),
    limit(1),
  )

  return onSnapshot(activeQuery, (snapshot) => {
    const docSnap = snapshot.docs[0]
    onChange(docSnap ? toFeedingEntry(docSnap.id, docSnap.data()) : null)
  })
}

export function subscribeToTodayFeedingEntries(
  householdId: string,
  babyId: string,
  reference: Date,
  onChange: (entries: FeedingEntry[]) => void,
): Unsubscribe {
  const { start, end } = dayRange(reference)
  const todayQuery = query(
    feedingEntriesCollection(householdId, babyId),
    where('startedAt', '>=', Timestamp.fromDate(start)),
    where('startedAt', '<', Timestamp.fromDate(end)),
    orderBy('startedAt', 'desc'),
  )

  return onSnapshot(todayQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => toFeedingEntry(docSnap.id, docSnap.data())))
  })
}

export async function startBottleFeeding(
  householdId: string,
  babyId: string,
  createdBy: string,
): Promise<void> {
  const now = Timestamp.now()
  await addDoc(feedingEntriesCollection(householdId, babyId), {
    type: 'bottle' satisfies FeedingType,
    startedAt: now,
    endedAt: null,
    durationSeconds: null,
    volumeMl: null,
    notes: '',
    createdBy,
    createdAt: now,
  })
}

export async function stopBottleFeeding(
  householdId: string,
  babyId: string,
  entryId: string,
  startedAt: Date,
  volumeMl: number | null,
): Promise<void> {
  const now = new Date()
  await updateDoc(doc(feedingEntriesCollection(householdId, babyId), entryId), {
    endedAt: Timestamp.fromDate(now),
    durationSeconds: secondsBetween(startedAt, now),
    volumeMl,
  })
}

export async function logSolidFeeding(
  householdId: string,
  babyId: string,
  createdBy: string,
  notes: string,
): Promise<void> {
  const now = Timestamp.now()
  await addDoc(feedingEntriesCollection(householdId, babyId), {
    type: 'solid' satisfies FeedingType,
    startedAt: now,
    endedAt: now,
    durationSeconds: 0,
    volumeMl: null,
    notes,
    createdBy,
    createdAt: now,
  })
}
