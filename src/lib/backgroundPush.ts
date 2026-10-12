import {
  closeSleepTimerNotifications,
  SLEEP_TIMER_PUSH,
  SLEEP_TIMER_STOP_PUSH,
  SLEEP_TIMER_TITLE,
  sleepTimerNotificationOptions,
} from './sleepTimerNotification'
import {
  closeVaccinePurchaseQuestion,
  readVaccinePurchaseClose,
  readVaccinePush,
  vaccineNotification,
} from './vaccineNotification'

/** `data.type` of the medication reminder push (functions/src/medicationReminders.ts). */
export const MEDICATION_REMINDER_PUSH = 'medication-reminder'

/** The daily "not given yet" reminder: one per medication, a new day's replaces the last. */
export function medicationNotification(medicationName: string): { title: string; options: NotificationOptions } {
  return {
    title: `Reminder: ${medicationName}`,
    options: {
      body: `${medicationName} hasn't been given yet today.`,
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      tag: `medication-reminder-${medicationName}`,
      data: { url: '/' },
    },
  }
}

/**
 * Turns a server push (all data-only, see functions/src/push.ts) into the
 * notification it stands for, or closes the one it settles. The service worker
 * runs it for pushes received in the background, the open app for those it
 * receives in the foreground. Unknown pushes are ignored.
 */
export async function handleBackgroundPush(
  registration: ServiceWorkerRegistration,
  data: Record<string, string>,
  now: Date,
): Promise<void> {
  switch (data.type) {
    case SLEEP_TIMER_PUSH:
      // One a minute while a sleep runs: the text is computed here, so a late push is still right.
      if (data.babyId && data.babyName && data.startedAt) {
        await registration.showNotification(
          SLEEP_TIMER_TITLE,
          sleepTimerNotificationOptions(data.babyId, data.babyName, new Date(data.startedAt), now),
        )
      }
      return
    case SLEEP_TIMER_STOP_PUSH:
      // Without a baby (older server), every timer notification goes.
      await closeSleepTimerNotifications(registration, data.babyId || undefined)
      return
    case MEDICATION_REMINDER_PUSH:
      if (data.medicationName) {
        const { title, options } = medicationNotification(data.medicationName)
        await registration.showNotification(title, options)
      }
      return
  }

  // Vaccine reminders before a pediatrician visit (functions/src/vaccineReminders.ts).
  const vaccinePush = readVaccinePush(data)
  if (vaccinePush) {
    const { title, options } = vaccineNotification(vaccinePush)
    await registration.showNotification(title, options)
    return
  }
  const settledVisitId = readVaccinePurchaseClose(data)
  if (settledVisitId) await closeVaccinePurchaseQuestion(registration, settledVisitId)
}
