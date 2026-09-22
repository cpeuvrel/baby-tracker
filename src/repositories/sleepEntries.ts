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
import { sleepEntriesCollection } from '../lib/paths'
import type { DateRange } from '../lib/timeline'
import type { SleepEntry } from '../types/models'

function toSleepEntry(id: string, data: Record<string, unknown>): SleepEntry {
  return {
    id,
    startedAt: timestampToIso(data.startedAt as Timestamp),
    endedAt: nullableTimestampToIso(data.endedAt as Timestamp | null),
    durationSeconds: (data.durationSeconds as number | null) ?? null,
    notes: (data.notes as string) ?? '',
    createdBy: data.createdBy as string,
    createdAt: timestampToIso(data.createdAt as Timestamp),
  }
}

export function subscribeToActiveSleep(
  householdId: string,
  babyId: string,
  onChange: (entry: SleepEntry | null) => void,
): Unsubscribe {
  const activeQuery = query(
    sleepEntriesCollection(householdId, babyId),
    where('endedAt', '==', null),
    limit(1),
  )

  return onSnapshot(activeQuery, (snapshot) => {
    const docSnap = snapshot.docs[0]
    onChange(docSnap ? toSleepEntry(docSnap.id, docSnap.data()) : null)
  })
}

export function subscribeToSleepEntriesInRange(
  householdId: string,
  babyId: string,
  range: DateRange,
  onChange: (entries: SleepEntry[]) => void,
): Unsubscribe {
  const rangeQuery = query(
    sleepEntriesCollection(householdId, babyId),
    where('startedAt', '>=', Timestamp.fromDate(range.start)),
    where('startedAt', '<', Timestamp.fromDate(range.end)),
    orderBy('startedAt', 'desc'),
  )

  return onSnapshot(rangeQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => toSleepEntry(docSnap.id, docSnap.data())))
  })
}

export async function startSleep(
  householdId: string,
  babyId: string,
  createdBy: string,
): Promise<void> {
  const now = Timestamp.now()
  await addDoc(sleepEntriesCollection(householdId, babyId), {
    startedAt: now,
    endedAt: null,
    durationSeconds: null,
    notes: '',
    createdBy,
    createdAt: now,
  })
}

export async function stopSleep(
  householdId: string,
  babyId: string,
  entryId: string,
  startedAt: Date,
): Promise<void> {
  const now = new Date()
  await updateDoc(doc(sleepEntriesCollection(householdId, babyId), entryId), {
    endedAt: Timestamp.fromDate(now),
    durationSeconds: secondsBetween(startedAt, now),
  })
}
