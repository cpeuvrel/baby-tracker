import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore'
import { listenerErrorHandler } from '../lib/firestoreSnapshots'
import { remindersCollection } from '../lib/paths'
import type { Reminder } from '../types/models'

/**
 * The reminder's document id, derived from the medication name. A name that is already a valid
 * id keeps it, so existing reminders ("Vitamin D") stay where they are; one Firestore would
 * reject (a `/` as in Nara's "Vitamin/Probiotic", empty, `.`, `..`, `__…__`) is encoded.
 * The `medicationName` field stays the source of truth (the Cloud Function reads it).
 */
export function reminderDocId(medicationName: string): string {
  const valid =
    medicationName !== '' &&
    medicationName !== '.' &&
    medicationName !== '..' &&
    !medicationName.includes('/') &&
    !/^__.*__$/.test(medicationName)
  return valid ? medicationName : `~${encodeURIComponent(medicationName)}`
}

function toReminder(id: string, data: Record<string, unknown>): Reminder {
  return {
    id,
    medicationName: data.medicationName as string,
    timeOfDay: data.timeOfDay as string,
    active: (data.active as boolean) ?? false,
  }
}

export function subscribeToReminder(
  householdId: string,
  babyId: string,
  medicationName: string,
  onChange: (reminder: Reminder | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const reminderDoc = doc(remindersCollection(householdId, babyId), reminderDocId(medicationName))

  return onSnapshot(
    reminderDoc,
    (snapshot) => {
      onChange(snapshot.exists() ? toReminder(snapshot.id, snapshot.data()) : null)
    },
    listenerErrorHandler('reminders', onError),
  )
}

export async function setReminder(
  householdId: string,
  babyId: string,
  medicationName: string,
  timeOfDay: string,
  active: boolean,
): Promise<void> {
  const reminderDoc = doc(remindersCollection(householdId, babyId), reminderDocId(medicationName))
  await setDoc(reminderDoc, { medicationName, timeOfDay, active })
}
