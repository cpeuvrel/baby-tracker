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
  writeBatch,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore'
import { secondsBetween } from '../lib/duration'
import { batchInsert } from '../lib/firestoreBatch'
import { nullableTimestampToIso, timestampToIso } from '../lib/firestoreDates'
import { listenerErrorHandler, mapDocs } from '../lib/firestoreSnapshots'
import { db } from '../lib/firebase'
import { sleepEntriesCollection, sleepTimerLockDoc } from '../lib/paths'
import type { DateRange } from '../lib/timeline'
import type { SleepEntry } from '../types/models'

function toSleepEntry(id: string, data: Record<string, unknown>): SleepEntry {
  return {
    id,
    startedAt: timestampToIso(data.startedAt),
    endedAt: nullableTimestampToIso(data.endedAt),
    durationSeconds: (data.durationSeconds as number | null) ?? null,
    notes: (data.notes as string) ?? '',
    createdBy: data.createdBy as string,
    createdAt: timestampToIso(data.createdAt ?? data.startedAt),
  }
}

/** Every sleep in progress, earliest first: normally one, but two devices can each start one. */
export function subscribeToActiveSleeps(
  householdId: string,
  babyId: string,
  onChange: (entries: SleepEntry[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const activeQuery = query(sleepEntriesCollection(householdId, babyId), where('endedAt', '==', null))

  return onSnapshot(
    activeQuery,
    (snapshot) => {
      const entries = mapDocs(snapshot, toSleepEntry)
      onChange(entries.sort((a, b) => a.startedAt.localeCompare(b.startedAt)))
    },
    listenerErrorHandler('sleepEntries', onError),
  )
}

/**
 * Writes a sleep that runs (again) together with the lock naming it: firestore.rules refuse the
 * whole write while another sleep runs, e.g. one started on another device this one did not see yet.
 */
async function writeRunningSleep(
  householdId: string,
  babyId: string,
  entryRef: DocumentReference,
  data: Record<string, unknown>,
  isNew: boolean,
): Promise<void> {
  const batch = writeBatch(db)
  if (isNew) batch.set(entryRef, data)
  else batch.update(entryRef, data)
  batch.set(sleepTimerLockDoc(householdId, babyId), { entryId: entryRef.id })
  await batch.commit()
}

export function subscribeToSleepEntriesInRange(
  householdId: string,
  babyId: string,
  range: DateRange,
  onChange: (entries: SleepEntry[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const rangeQuery = query(
    sleepEntriesCollection(householdId, babyId),
    where('startedAt', '>=', Timestamp.fromDate(range.start)),
    where('startedAt', '<', Timestamp.fromDate(range.end)),
    orderBy('startedAt', 'desc'),
  )

  return onSnapshot(
    rangeQuery,
    (snapshot) => {
      onChange(mapDocs(snapshot, toSleepEntry))
    },
    listenerErrorHandler('sleepEntries', onError),
  )
}

export function subscribeToRecentSleepEntries(
  householdId: string,
  babyId: string,
  count: number,
  onChange: (entries: SleepEntry[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const recentQuery = query(
    sleepEntriesCollection(householdId, babyId),
    orderBy('startedAt', 'desc'),
    limit(count),
  )

  return onSnapshot(
    recentQuery,
    (snapshot) => {
      onChange(mapDocs(snapshot, toSleepEntry))
    },
    listenerErrorHandler('sleepEntries', onError),
  )
}

export async function getAllSleepEntries(
  householdId: string,
  babyId: string,
): Promise<SleepEntry[]> {
  const allQuery = query(sleepEntriesCollection(householdId, babyId), orderBy('startedAt'))
  const snapshot = await getDocs(allQuery)
  return mapDocs(snapshot, toSleepEntry)
}

export async function importSleepEntries(
  householdId: string,
  babyId: string,
  entries: SleepEntry[],
): Promise<void> {
  // A timer still running in the export is stale: it would be refused without the lock anyway.
  const stopped = entries.filter((entry) => entry.endedAt != null)
  await batchInsert(sleepEntriesCollection(householdId, babyId), stopped, (entry) => ({
    startedAt: Timestamp.fromDate(new Date(entry.startedAt)),
    endedAt: entry.endedAt ? Timestamp.fromDate(new Date(entry.endedAt)) : null,
    durationSeconds: entry.durationSeconds,
    notes: entry.notes,
    createdBy: entry.createdBy,
    createdAt: Timestamp.fromDate(new Date(entry.createdAt)),
  }))
}

export async function startSleep(
  householdId: string,
  babyId: string,
  createdBy: string,
  startedAt: Date = new Date(),
  notes = '',
): Promise<void> {
  await writeRunningSleep(
    householdId,
    babyId,
    doc(sleepEntriesCollection(householdId, babyId)),
    {
      startedAt: Timestamp.fromDate(startedAt),
      endedAt: null,
      durationSeconds: null,
      notes,
      createdBy,
      createdAt: Timestamp.now(),
    },
    true,
  )
}

export interface LogSleepInput {
  startedAt: Date
  endedAt: Date
  notes: string
}

export async function logSleep(
  householdId: string,
  babyId: string,
  createdBy: string,
  input: LogSleepInput,
): Promise<void> {
  await addDoc(sleepEntriesCollection(householdId, babyId), {
    startedAt: Timestamp.fromDate(input.startedAt),
    endedAt: Timestamp.fromDate(input.endedAt),
    durationSeconds: secondsBetween(input.startedAt, input.endedAt),
    notes: input.notes,
    createdBy,
    createdAt: Timestamp.now(),
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

/**
 * Puts a stopped sleep back in progress: the timer runs again from `startedAt`. `notes`, when
 * given, replaces the sleep's notes in the same write.
 */
export async function resumeSleep(
  householdId: string,
  babyId: string,
  entryId: string,
  startedAt: Date,
  notes?: string,
): Promise<void> {
  await writeRunningSleep(
    householdId,
    babyId,
    doc(sleepEntriesCollection(householdId, babyId), entryId),
    {
      startedAt: Timestamp.fromDate(startedAt),
      endedAt: null,
      durationSeconds: null,
      ...(notes !== undefined && { notes }),
    },
    false,
  )
}

/** Moves the start of a sleep in progress: its live timer follows. */
export async function updateSleepStart(
  householdId: string,
  babyId: string,
  entryId: string,
  startedAt: Date,
): Promise<void> {
  await updateDoc(doc(sleepEntriesCollection(householdId, babyId), entryId), {
    startedAt: Timestamp.fromDate(startedAt),
  })
}

export interface UpdateSleepInput {
  startedAt: Date
  endedAt: Date | null
  notes: string
}

export async function updateSleepEntry(
  householdId: string,
  babyId: string,
  entryId: string,
  input: UpdateSleepInput,
): Promise<void> {
  const entryRef = doc(sleepEntriesCollection(householdId, babyId), entryId)
  const data = {
    startedAt: Timestamp.fromDate(input.startedAt),
    endedAt: input.endedAt ? Timestamp.fromDate(input.endedAt) : null,
    durationSeconds: input.endedAt ? secondsBetween(input.startedAt, input.endedAt) : null,
    notes: input.notes,
  }
  // Without an end time the sleep runs: it takes the lock like a start.
  if (input.endedAt) await updateDoc(entryRef, data)
  else await writeRunningSleep(householdId, babyId, entryRef, data, false)
}

export async function deleteSleepEntry(
  householdId: string,
  babyId: string,
  entryId: string,
): Promise<void> {
  await deleteDoc(doc(sleepEntriesCollection(householdId, babyId), entryId))
}
