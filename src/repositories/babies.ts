import { addDoc, onSnapshot, orderBy, query, type Unsubscribe } from 'firebase/firestore'
import { babiesCollection } from '../lib/paths'
import type { Baby } from '../types/models'

export function subscribeToBabies(
  householdId: string,
  onChange: (babies: Baby[]) => void,
): Unsubscribe {
  const babiesQuery = query(babiesCollection(householdId), orderBy('name'))

  return onSnapshot(babiesQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          name: data.name as string,
          birthDate: data.birthDate as string,
        }
      }),
    )
  })
}

export async function addBaby(householdId: string, name: string, birthDate: string): Promise<void> {
  await addDoc(babiesCollection(householdId), { name, birthDate })
}
