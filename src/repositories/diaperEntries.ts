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
