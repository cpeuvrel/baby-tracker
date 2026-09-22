import {
  addDoc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { timestampToIso } from '../lib/firestoreDates'
import { diaperEntriesCollection } from '../lib/paths'
import { dayRange } from '../lib/timeline'
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

export function subscribeToTodayDiaperEntries(
  householdId: string,
  babyId: string,
  reference: Date,
  onChange: (entries: DiaperEntry[]) => void,
): Unsubscribe {
  const { start, end } = dayRange(reference)
  const todayQuery = query(
    diaperEntriesCollection(householdId, babyId),
    where('occurredAt', '>=', Timestamp.fromDate(start)),
    where('occurredAt', '<', Timestamp.fromDate(end)),
    orderBy('occurredAt', 'desc'),
  )

  return onSnapshot(todayQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => toDiaperEntry(docSnap.id, docSnap.data())))
  })
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
