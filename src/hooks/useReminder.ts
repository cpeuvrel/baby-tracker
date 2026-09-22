import { useEffect, useState } from 'react'
import { subscribeToReminder } from '../repositories/reminders'
import type { Reminder } from '../types/models'

export function useReminder(
  householdId: string | null,
  babyId: string | null,
  medicationName: string,
): Reminder | null {
  const [reminder, setReminder] = useState<Reminder | null>(null)

  useEffect(() => {
    if (!householdId || !babyId) {
      setReminder(null)
      return
    }
    return subscribeToReminder(householdId, babyId, medicationName, setReminder)
  }, [householdId, babyId, medicationName])

  return reminder
}
