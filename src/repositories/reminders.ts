import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore'
import { remindersCollection } from '../lib/paths'
import type { Reminder } from '../types/models'

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
): Unsubscribe {
  const reminderDoc = doc(remindersCollection(householdId, babyId), medicationName)

  return onSnapshot(reminderDoc, (snapshot) => {
    onChange(snapshot.exists() ? toReminder(snapshot.id, snapshot.data()) : null)
  })
}

export async function setReminder(
  householdId: string,
  babyId: string,
  medicationName: string,
  timeOfDay: string,
  active: boolean,
): Promise<void> {
  const reminderDoc = doc(remindersCollection(householdId, babyId), medicationName)
  await setDoc(reminderDoc, { medicationName, timeOfDay, active })
}
