import {
  CHROME_AUTO_NOTIFICATION_TAG,
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
 * The last stop each baby's timer got (its server `asOf`), kept across pushes:
 * the service worker does not live from one push to the next.
 */
export interface SleepStopStore {
  get(babyId: string): Promise<string | null>
  set(babyId: string, asOf: string): Promise<void>
}

const SLEEP_STOP_CACHE = 'sleep-timer-stops'

/** The service worker's store, in the Cache API (also there in a worker woken by a push). */
export function cacheSleepStopStore(cacheStorage: CacheStorage): SleepStopStore {
  const key = (babyId: string) => `/__sleep-timer-stop/${encodeURIComponent(babyId)}`
  return {
    async get(babyId) {
      const response = await (await cacheStorage.open(SLEEP_STOP_CACHE)).match(key(babyId))
      return response ? response.text() : null
    },
    async set(babyId, asOf) {
      await (await cacheStorage.open(SLEEP_STOP_CACHE)).put(key(babyId), new Response(asOf))
    },
  }
}

function notLaterThan(asOf: string, other: string): boolean {
  return new Date(asOf).getTime() <= new Date(other).getTime()
}

/**
 * The `data` of an FCM push (the JSON body of the push event), or `null` when
 * the push is not one of the server's: only string values are kept.
 */
export function readPushData(payload: unknown): Record<string, string> | null {
  if (typeof payload !== 'object' || payload == null) return null
  const data = (payload as { data?: unknown }).data
  if (typeof data !== 'object' || data == null) return null
  return Object.fromEntries(
    Object.entries(data).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

/**
 * Turns a server push (all data-only, see functions/src/push.ts) into the
 * notification it stands for, or closes the one it settles. The service worker
 * runs it for every push, app open or not. Unknown pushes are ignored.
 */
export async function handleBackgroundPush(
  registration: ServiceWorkerRegistration,
  data: Record<string, string>,
  now: Date,
  stops?: SleepStopStore,
): Promise<void> {
  switch (data.type) {
    case SLEEP_TIMER_PUSH:
      // One a minute while a sleep runs: the text is computed here, so a late push is still right.
      if (data.babyId && data.babyName && data.startedAt) {
        // Read before the stop this phone already got (a tick that crossed it): the sleep is over.
        const lastStop = data.asOf && stops ? await stops.get(data.babyId) : null
        if (lastStop && notLaterThan(data.asOf, lastStop)) {
          await closeSleepTimerNotifications(registration, data.babyId)
          return
        }
        await registration.showNotification(
          SLEEP_TIMER_TITLE,
          sleepTimerNotificationOptions(data.babyId, data.babyName, new Date(data.startedAt), now),
        )
      }
      return
    case SLEEP_TIMER_STOP_PUSH: {
      if (data.babyId && data.asOf && stops) {
        const lastStop = await stops.get(data.babyId)
        if (!lastStop || notLaterThan(lastStop, data.asOf)) await stops.set(data.babyId, data.asOf)
      }
      // Without a baby (older server), every timer notification goes.
      await closeSleepTimerNotifications(registration, data.babyId || undefined)
      // And Chrome's "updated in the background" one, if a push ever left it.
      const chromeNotices = await registration.getNotifications({ tag: CHROME_AUTO_NOTIFICATION_TAG })
      chromeNotices.forEach((notification) => notification.close())
      return
    }
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
