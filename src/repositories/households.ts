import { limit, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore'
import { householdsCollection } from '../lib/paths'
import type { Household } from '../types/models'

export function subscribeToHouseholdForUser(
  uid: string,
  onChange: (household: Household | null) => void,
): Unsubscribe {
  const membershipQuery = query(
    householdsCollection(),
    where('memberUids', 'array-contains', uid),
    limit(1),
  )

  return onSnapshot(membershipQuery, (snapshot) => {
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
  })
}
