import {
  addDoc,
  arrayUnion,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { timestampToIso } from '../lib/firestoreDates'
import { listenerErrorHandler, mapDocs } from '../lib/firestoreSnapshots'
import { pediatricianVisitsCollection } from '../lib/paths'
import type { PediatricianVisit, VisitDiscussion, VisitRemark } from '../types/models'

export interface NewPediatricianVisit {
  date: string
  vaccinated: boolean
}

export type PediatricianVisitChanges = Partial<
  Pick<PediatricianVisit, 'date' | 'vaccinated' | 'vaccineBought' | 'remarks' | 'discussions'>
>

function toPediatricianVisit(id: string, data: Record<string, unknown>): PediatricianVisit {
  return {
    id,
    date: data.date as string,
    vaccinated: (data.vaccinated as boolean) ?? false,
    vaccineBought: (data.vaccineBought as boolean | undefined) ?? false,
    remarks: (data.remarks as VisitRemark[] | undefined) ?? [],
    discussions: (data.discussions as VisitDiscussion[] | undefined) ?? [],
    createdBy: data.createdBy as string,
    createdAt: timestampToIso(data.createdAt ?? data.date),
  }
}

/** Visits of a baby, most recent appointment first. */
export function subscribeToPediatricianVisits(
  householdId: string,
  babyId: string,
  onChange: (visits: PediatricianVisit[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const visitsQuery = query(pediatricianVisitsCollection(householdId, babyId), orderBy('date', 'desc'))

  return onSnapshot(
    visitsQuery,
    (snapshot) => {
      onChange(mapDocs(snapshot, toPediatricianVisit))
    },
    listenerErrorHandler('pediatricianVisits', onError),
  )
}

/** Creates a visit and returns its id. */
export async function addPediatricianVisit(
  householdId: string,
  babyId: string,
  createdBy: string,
  visit: NewPediatricianVisit,
): Promise<string> {
  const ref = await addDoc(pediatricianVisitsCollection(householdId, babyId), {
    date: visit.date,
    vaccinated: visit.vaccinated,
    vaccineBought: false,
    remarks: [],
    discussions: [],
    createdBy,
    createdAt: Timestamp.now(),
  })
  return ref.id
}

export async function updatePediatricianVisit(
  householdId: string,
  babyId: string,
  visitId: string,
  changes: PediatricianVisitChanges,
): Promise<void> {
  await updateDoc(doc(pediatricianVisitsCollection(householdId, babyId), visitId), changes)
}

interface VisitItemsByField {
  remarks: VisitRemark[]
  discussions: VisitDiscussion[]
}

/**
 * Changes a visit's remarks or discussions from their latest stored value, in a transaction:
 * both parents may edit the same visit at once, and rewriting the whole list as one phone last
 * saw it would drop the other's change. `mutate` may run more than once (the transaction retries
 * on a concurrent write), so it must only compute the new list, e.g.
 * `items => [...items, remark]`, `items => items.map(...)`, `items => items.filter(...)`.
 * Like every transaction, it fails while offline instead of being queued.
 */
export async function mutateVisitItems<F extends keyof VisitItemsByField>(
  householdId: string,
  babyId: string,
  visitId: string,
  field: F,
  mutate: (items: VisitItemsByField[F]) => VisitItemsByField[F],
): Promise<void> {
  const visitRef = doc(pediatricianVisitsCollection(householdId, babyId), visitId)
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(visitRef)
    if (!snapshot.exists()) throw new Error('This visit no longer exists.')
    const items = (snapshot.data()[field] as VisitItemsByField[F] | undefined) ?? []
    transaction.update(visitRef, { [field]: mutate(items) })
  })
}

/**
 * Adds one remark or question. Unlike `mutateVisitItems`, this is a plain update with
 * `arrayUnion`: it is queued while offline (notes taken in a waiting room without network still
 * land) and a concurrent change from the other phone is merged by the server, not overwritten.
 */
export async function appendVisitItem<F extends keyof VisitItemsByField>(
  householdId: string,
  babyId: string,
  visitId: string,
  field: F,
  item: VisitItemsByField[F][number],
): Promise<void> {
  const visitRef = doc(pediatricianVisitsCollection(householdId, babyId), visitId)
  await updateDoc(visitRef, { [field]: arrayUnion(item) })
}

export async function deletePediatricianVisit(
  householdId: string,
  babyId: string,
  visitId: string,
): Promise<void> {
  await deleteDoc(doc(pediatricianVisitsCollection(householdId, babyId), visitId))
}
