import { addDoc, limit, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore'
import { householdsCollection } from '../lib/paths'
import type { Household } from '../types/models'

const DEFAULT_HOUSEHOLD_NAME = 'My Family'

export async function createHousehold(memberUid: string): Promise<string> {
  const docRef = await addDoc(householdsCollection(), {
    name: DEFAULT_HOUSEHOLD_NAME,
    memberUids: [memberUid],
  })
  return docRef.id
}

export function subscribeToHouseholdForUser(
  uid: string,
  onChange: (household: Household | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const membershipQuery = query(
    householdsCollection(),
    where('memberUids', 'array-contains', uid),
    limit(1),
  )

  return onSnapshot(
    membershipQuery,
    (snapshot) => {
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
    // Sans handler d'erreur, un refus des Security Rules ou un émulateur
    // injoignable ne rappelle jamais : l'app reste sur "Loading…" à vie.
    (error) => onError?.(error),
  )
}
