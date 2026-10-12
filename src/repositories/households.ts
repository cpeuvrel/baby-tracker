import {
  addDoc,
  deleteDoc,
  documentId,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { addBaby } from './babies'
import { householdsCollection } from '../lib/paths'
import type { BabySex, Household } from '../types/models'

const DEFAULT_HOUSEHOLD_NAME = 'My Family'

/**
 * The household a user belongs to. The app handles a single one: should a second exist anyway,
 * ordering by id makes the pick stable instead of arbitrary.
 */
function membershipQuery(uid: string) {
  return query(
    householdsCollection(),
    where('memberUids', 'array-contains', uid),
    orderBy(documentId()),
    limit(1),
  )
}

/**
 * The id of the user's household as the server knows it, or null. Asked of the server, not the
 * cache: an empty offline cache must not pass for "no family yet". Rejects while offline.
 */
async function findHouseholdOnServer(uid: string): Promise<string | null> {
  const existing = await getDocsFromServer(membershipQuery(uid))
  return existing.docs[0]?.id ?? null
}

/** Creates the user's household, or returns the existing one: a user never gets a second. */
export async function createHousehold(memberUid: string): Promise<string> {
  const existingId = await findHouseholdOnServer(memberUid)
  if (existingId) return existingId
  const docRef = await addDoc(householdsCollection(), {
    name: DEFAULT_HOUSEHOLD_NAME,
    memberUids: [memberUid],
  })
  return docRef.id
}

export interface FirstBaby {
  name: string
  birthDate: string
  sex: BabySex | null
}

/**
 * Onboarding: creates the household together with its first child, and returns the household id.
 * When the server already knows a household for the user (onboarding shown from a stale cache),
 * nothing is written: the household listener brings the existing family in.
 * Not a single batch: firestore.rules check a baby's household with `get()`, which does not see
 * a household created in the same batch. A failed child creation removes the new household
 * instead, so no family is left without its first child.
 */
export async function createHouseholdWithBaby(memberUid: string, baby: FirstBaby): Promise<string> {
  const existingId = await findHouseholdOnServer(memberUid)
  if (existingId) return existingId
  const householdRef = await addDoc(householdsCollection(), {
    name: DEFAULT_HOUSEHOLD_NAME,
    memberUids: [memberUid],
  })
  try {
    await addBaby(householdRef.id, baby.name, baby.birthDate, baby.sex)
  } catch (error) {
    try {
      await deleteDoc(householdRef)
    } catch (cleanupError) {
      console.error('[household] could not remove the household left without a child', cleanupError)
    }
    throw error
  }
  return householdRef.id
}

export function subscribeToHouseholdForUser(
  uid: string,
  onChange: (household: Household | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    membershipQuery(uid),
    (snapshot) => {
      // Offline at start-up (empty or cleared cache), Firestore first serves an empty snapshot
      // from the cache: that is "not known yet", not "no family". Stay loading until the server
      // answers, rather than offering to create a second household.
      if (snapshot.empty && snapshot.metadata.fromCache) return
      const docSnap = snapshot.docs[0]
      if (!docSnap) {
        onChange(null)
        return
      }
      const data = docSnap.data()
      onChange({
        id: docSnap.id,
        name: data.name as string,
        memberUids: data.memberUids as string[],
      })
    },
    // Without an error handler, a Security Rules rejection or an unreachable
    // emulator never calls back: the app stays on "Loading…" forever.
    (error) => onError?.(error),
  )
}
