import { addDoc, doc, onSnapshot, orderBy, query, updateDoc, type Unsubscribe } from 'firebase/firestore'
import { babiesCollection } from '../lib/paths'
import type { Baby, BabySex, NighttimeHours } from '../types/models'

export function subscribeToBabies(
  householdId: string,
  onChange: (babies: Baby[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const babiesQuery = query(babiesCollection(householdId), orderBy('name'))

  return onSnapshot(
    babiesQuery,
    (snapshot) => {
      onChange(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data()
          return {
            id: docSnap.id,
            name: data.name as string,
            birthDate: data.birthDate as string,
            sex: (data.sex as BabySex | null) ?? null,
            nighttimeHours: (data.nighttimeHours as NighttimeHours | null) ?? null,
            photoDataUrl: (data.photoDataUrl as string | null) ?? null,
          }
        }),
      )
    },
    (error) => onError?.(error),
  )
}

export async function addBaby(
  householdId: string,
  name: string,
  birthDate: string,
  sex: BabySex | null = null,
): Promise<void> {
  await addDoc(babiesCollection(householdId), { name, birthDate, sex })
}

export async function updateBaby(
  householdId: string,
  babyId: string,
  name: string,
  birthDate: string,
  sex: BabySex | null,
): Promise<void> {
  await updateDoc(doc(babiesCollection(householdId), babyId), { name, birthDate, sex })
}

export async function updateNighttimeHours(
  householdId: string,
  babyId: string,
  nighttimeHours: NighttimeHours,
): Promise<void> {
  await updateDoc(doc(babiesCollection(householdId), babyId), { nighttimeHours })
}

export async function updateBabyPhoto(
  householdId: string,
  babyId: string,
  photoDataUrl: string | null,
): Promise<void> {
  await updateDoc(doc(babiesCollection(householdId), babyId), { photoDataUrl })
}
