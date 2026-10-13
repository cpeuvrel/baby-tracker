import { subscribeToReminder } from '../repositories/reminders'
import type { Reminder } from '../types/models'
import { useSubscriptionState } from './useSubscriptionState'

export interface ReminderState {
  /** `null` while loading, or when the medication has no reminder yet. */
  reminder: Reminder | null
  loading: boolean
  error: Error | null
}

/** The medication's reminder, with the subscription's loading and error state. */
export function useReminderState(
  householdId: string | null,
  babyId: string | null,
  medicationName: string,
): ReminderState {
  const key = householdId && babyId ? `${householdId}/${babyId}/${medicationName}` : null
  const { data, loading, error } = useSubscriptionState<Reminder | null>(
    key,
    (onNext, onError) => subscribeToReminder(householdId!, babyId!, medicationName, onNext, onError),
    null,
  )
  return { reminder: data, loading, error }
}

export function useReminder(
  householdId: string | null,
  babyId: string | null,
  medicationName: string,
): Reminder | null {
  return useReminderState(householdId, babyId, medicationName).reminder
}
