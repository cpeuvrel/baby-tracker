import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { timestampToIso } from '../lib/firestoreDates'
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
    createdAt: timestampToIso(data.createdAt as Timestamp),
  }
}

/** Visits of a baby, most recent appointment first. */
export function subscribeToPediatricianVisits(
  householdId: string,
  babyId: string,
  onChange: (visits: PediatricianVisit[]) => void,
): Unsubscribe {
  const visitsQuery = query(pediatricianVisitsCollection(householdId, babyId), orderBy('date', 'desc'))

  return onSnapshot(visitsQuery, (snapshot) => {
    onChange(snapshot.docs.map((docSnap) => toPediatricianVisit(docSnap.id, docSnap.data())))
  })
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

export async function deletePediatricianVisit(
  householdId: string,
  babyId: string,
  visitId: string,
): Promise<void> {
  await deleteDoc(doc(pediatricianVisitsCollection(householdId, babyId), visitId))
}
